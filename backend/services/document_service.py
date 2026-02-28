# services/document_service.py
import os
import uuid
from typing import Dict, List
from datetime import datetime

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# Pinecone setup
# ─────────────────────────────────────────────
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX   = os.getenv("PINECONE_INDEX_NAME", "rag-chatbot")
PINECONE_CLOUD   = os.getenv("PINECONE_CLOUD", "aws")
PINECONE_REGION  = os.getenv("PINECONE_REGION", "us-east-1")
EMBEDDING_DIM    = 384   # dimension for all-MiniLM-L6-v2

pc = Pinecone(api_key=PINECONE_API_KEY)

# Create index if it doesn't already exist
existing_indexes = [idx.name for idx in pc.list_indexes()]
if PINECONE_INDEX not in existing_indexes:
    pc.create_index(
        name=PINECONE_INDEX,
        dimension=EMBEDDING_DIM,
        metric="cosine",
        spec=ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
    )

pinecone_index = pc.Index(PINECONE_INDEX)

# ─────────────────────────────────────────────
# Embeddings (local — no extra API key needed)
# ─────────────────────────────────────────────
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# Single shared LangChain vector store wrapper
vector_store = PineconeVectorStore(
    index=pinecone_index,
    embedding=embeddings,
    text_key="text",
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
)

# ─────────────────────────────────────────────
# In-memory metadata stores
# ─────────────────────────────────────────────
documents_db: Dict[str, dict] = {}          # doc_id  → metadata
thread_docs_db: Dict[str, List[str]] = {}   # thread_id → [doc_id, ...]

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─────────────────────────────────────────────
# 1. Save & process uploaded PDF
# ─────────────────────────────────────────────
def process_pdf(thread_id: str, file_bytes: bytes, filename: str) -> dict:
    """
    Save PDF → chunk → embed → upsert into Pinecone.
    Each vector carries thread_id + doc_id metadata for filtered retrieval.
    """
    doc_id    = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{filename}")

    # Write to disk (PyPDFLoader requires a file path)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Load & split
    loader = PyPDFLoader(file_path)
    pages  = loader.load()
    chunks = text_splitter.split_documents(pages)

    if not chunks:
        return {"error": "Could not extract any text from the PDF."}

    # Tag every chunk with routing metadata
    for chunk in chunks:
        chunk.metadata.update({
            "doc_id":    doc_id,
            "thread_id": thread_id,
            "filename":  filename,
        })

    # Upsert → Pinecone (langchain_pinecone handles batching automatically)
    vector_store.add_documents(chunks)

    # Store metadata locally
    documents_db[doc_id] = {
        "doc_id":      doc_id,
        "thread_id":   thread_id,
        "filename":    filename,
        "file_path":   file_path,
        "chunk_count": len(chunks),
        "uploaded_at": datetime.utcnow().isoformat(),
    }
    thread_docs_db.setdefault(thread_id, []).append(doc_id)

    return {
        "doc_id":         doc_id,
        "filename":       filename,
        "chunks_indexed": len(chunks),
    }


# ─────────────────────────────────────────────
# 2. Retrieve relevant context for a query
# ─────────────────────────────────────────────
def retrieve_context(thread_id: str, query: str, k: int = 4) -> str:
    """
    Similarity search scoped to this thread via Pinecone metadata filter.
    Returns a formatted string ready to inject into the system prompt.
    """
    if thread_id not in thread_docs_db:
        return ""

    results = vector_store.similarity_search(
        query,
        k=k,
        filter={"thread_id": {"$eq": thread_id}},
    )

    if not results:
        return ""

    parts = []
    for i, doc in enumerate(results, 1):
        source = doc.metadata.get("filename", "unknown")
        parts.append(f"[Source {i} – {source}]\n{doc.page_content}")

    return "\n\n".join(parts)


# ─────────────────────────────────────────────
# 3. List documents for a thread
# ─────────────────────────────────────────────
def get_documents_for_thread(thread_id: str) -> List[dict]:
    doc_ids = thread_docs_db.get(thread_id, [])
    return [documents_db[did] for did in doc_ids if did in documents_db]


# ─────────────────────────────────────────────
# 4. Delete a document (vectors + disk file)
# ─────────────────────────────────────────────
def delete_document(doc_id: str) -> dict:
    if doc_id not in documents_db:
        return {"error": "Document not found."}

    meta      = documents_db.pop(doc_id)
    thread_id = meta["thread_id"]

    # Remove from thread index
    if thread_id in thread_docs_db:
        thread_docs_db[thread_id] = [
            d for d in thread_docs_db[thread_id] if d != doc_id
        ]

    # Delete vectors from Pinecone by doc_id metadata filter
    pinecone_index.delete(filter={"doc_id": {"$eq": doc_id}})

    # Remove PDF from disk
    if os.path.exists(meta["file_path"]):
        os.remove(meta["file_path"])

    return {"deleted": doc_id, "filename": meta["filename"]}
