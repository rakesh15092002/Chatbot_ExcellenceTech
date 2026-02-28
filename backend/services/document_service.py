# services/document_service.py
import os
import uuid
from typing import Dict, List
from datetime import datetime, timezone

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
from db.sqlite_conn import get_connection

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX   = os.getenv("PINECONE_INDEX_NAME", "rag-chatbot")
PINECONE_CLOUD   = os.getenv("PINECONE_CLOUD", "aws")
PINECONE_REGION  = os.getenv("PINECONE_REGION", "us-east-1")
EMBEDDING_DIM    = 384

pc = Pinecone(api_key=PINECONE_API_KEY)

existing_indexes = [idx.name for idx in pc.list_indexes()]
if PINECONE_INDEX not in existing_indexes:
    pc.create_index(
        name=PINECONE_INDEX,
        dimension=EMBEDDING_DIM,
        metric="cosine",
        spec=ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
    )

pinecone_index = pc.Index(PINECONE_INDEX)

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

vector_store = PineconeVectorStore(
    index=pinecone_index,
    embedding=embeddings,
    text_key="text",
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────
# 1. Save & process uploaded PDF
# ─────────────────────────────────────────────
def process_pdf(thread_id: str, file_bytes: bytes, filename: str) -> dict:
    doc_id    = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{filename}")

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    loader = PyPDFLoader(file_path)
    pages  = loader.load()
    chunks = text_splitter.split_documents(pages)

    if not chunks:
        os.remove(file_path)
        return {"error": "Could not extract any text from the PDF."}

    for chunk in chunks:
        chunk.metadata.update({
            "doc_id":    doc_id,
            "thread_id": thread_id,
            "filename":  filename,
        })

    vector_store.add_documents(chunks)

    # ✅ Persist to SQLite — survives restarts
    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO documents
               (doc_id, thread_id, filename, file_path, chunk_count, uploaded_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (doc_id, thread_id, filename, file_path, len(chunks), _now()),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "doc_id":         doc_id,
        "filename":       filename,
        "chunks_indexed": len(chunks),
    }


# ─────────────────────────────────────────────
# 2. Retrieve relevant context for a query
# ─────────────────────────────────────────────
def retrieve_context(thread_id: str, query: str, k: int = 6) -> str:
    # ✅ Check SQLite first
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM documents WHERE thread_id = ?",
            (thread_id,)
        ).fetchone()
        has_docs = row["cnt"] > 0
    finally:
        conn.close()

    if not has_docs:
        return ""

    try:
        # ✅ Get chunks WITH their similarity scores
        results_with_scores = vector_store.similarity_search_with_score(
            query,
            k=k,
            filter={"thread_id": {"$eq": thread_id}},
        )
    except Exception as e:
        print(f"⚠️ Pinecone retrieval error: {e}")
        return ""

    if not results_with_scores:
        return ""

    # ✅ Debug — check scores in terminal
    print(f"📊 Pinecone scores: {[round(s, 3) for _, s in results_with_scores]}")

    # ✅ Pinecone cosine returns DISTANCE (lower = more similar)
    # 0.0 = perfect match | 0.5 = loosely related | 1.0 = no relation
    SIMILARITY_THRESHOLD = 0.5

    relevant_chunks = [
        doc for doc, score in results_with_scores
        if score <= SIMILARITY_THRESHOLD
    ]

    print(f"✅ Relevant chunks: {len(relevant_chunks)}/{len(results_with_scores)}")

    # ✅ Fallback — if no chunks pass threshold, use all top results
    if not relevant_chunks:
        print("⚠️ No chunks passed threshold — using top results as fallback")
        relevant_chunks = [doc for doc, _ in results_with_scores]

    parts = []
    for i, doc in enumerate(relevant_chunks, 1):
        source = doc.metadata.get("filename", "unknown")
        page   = doc.metadata.get("page", "?")
        parts.append(f"[Source {i} | {source} | Page {page}]\n{doc.page_content}")

    return "\n\n".join(parts)


# ─────────────────────────────────────────────
# 3. List documents for a thread
# ─────────────────────────────────────────────
def get_documents_for_thread(thread_id: str) -> List[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT doc_id, thread_id, filename, file_path, chunk_count, uploaded_at "
            "FROM documents WHERE thread_id = ? ORDER BY uploaded_at ASC",
            (thread_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ─────────────────────────────────────────────
# 4. Delete a document
# ─────────────────────────────────────────────
def delete_document(doc_id: str) -> dict:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM documents WHERE doc_id = ?", (doc_id,)
        ).fetchone()

        if not row:
            return {"error": "Document not found."}

        meta = dict(row)

        conn.execute("DELETE FROM documents WHERE doc_id = ?", (doc_id,))
        conn.commit()
    finally:
        conn.close()

    # ✅ Delete vectors from Pinecone
    try:
        pinecone_index.delete(filter={"doc_id": {"$eq": doc_id}})
    except Exception as e:
        print(f"⚠️ Pinecone delete error: {e}")

    # ✅ Remove PDF from disk
    if os.path.exists(meta["file_path"]):
        os.remove(meta["file_path"])

    return {"deleted": doc_id, "filename": meta["filename"]}
