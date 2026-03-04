# ─────────────────────────────────────────────
# REQUIRED INSTALLS:
#   pip install pymupdf langchain-community langchain-openai
#   pip install langchain-pinecone pinecone-client python-dotenv
# ─────────────────────────────────────────────

import os
import uuid
from typing import List
from datetime import datetime, timezone

from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings           # ✅ OpenAI
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
from db.sqlite_conn import get_connection

load_dotenv()

# ── Config ────────────────────────────────────
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX   = os.getenv("PINECONE_INDEX_NAME", "rag-chatbot")
PINECONE_CLOUD   = os.getenv("PINECONE_CLOUD", "aws")
PINECONE_REGION  = os.getenv("PINECONE_REGION", "us-east-1")
EMBEDDING_DIM    = 1536                                  # ✅ OpenAI dimension

# ── Pinecone init with index guard ────────────
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

# ── OpenAI Embeddings ─────────────────────────
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_key=os.getenv("OPENAI_API_KEY"),
)

vector_store = PineconeVectorStore(
    index=pinecone_index,
    embedding=embeddings,
    text_key="text",
)

# ── Chunking — page-based ─────────────────────
# Agar page 3000 chars se badi ho toh split, warna ek page = ek chunk
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=3000,
    chunk_overlap=100,
    length_function=len,
    separators=["\n\n", "\n", " ", ""],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────
# 1. Process & upload PDF
# ─────────────────────────────────────────────
def process_pdf(thread_id: str, file_bytes: bytes, filename: str) -> dict:
    doc_id    = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{filename}")

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    try:
        # ✅ Purane vectors delete karo pehle
        try:
            conn = get_connection()
            try:
                old_docs = conn.execute(
                    "SELECT doc_id FROM documents WHERE thread_id = ?",
                    (thread_id,)
                ).fetchall()
            finally:
                conn.close()

            for old in old_docs:
                pinecone_index.delete(filter={"doc_id": {"$eq": old["doc_id"]}})
                print(f"🗑️ Old vectors deleted for doc_id: {old['doc_id']}")
        except Exception as e:
            print(f"⚠️ Could not delete old vectors: {e}")

        loader = PyMuPDFLoader(file_path)
        pages  = loader.load()
        print(f"📄 Pages loaded: {len(pages)} from '{filename}'")

        for i, page in enumerate(pages):
            page.metadata["page_label"] = i + 1

        # ✅ Page-based chunking — har page ek chunk
        chunks = []
        for page in pages:
            content = page.page_content.strip()
            if not content:
                continue
            if len(content) > 3000:
                sub_chunks = text_splitter.split_documents([page])
                chunks.extend(sub_chunks)
            else:
                chunks.append(page)  # poori page ek chunk

        print(f"✂️  Chunks created: {len(chunks)}")

        if not chunks:
            os.remove(file_path)
            return {"error": "PDF is empty or could not be read as text."}

        for chunk in chunks:
            chunk.metadata.update({
                "doc_id":    doc_id,
                "thread_id": thread_id,
                "filename":  filename,
                "text":      chunk.page_content,
            })

        print(f"🔖 thread_id: '{thread_id}' | doc_id: '{doc_id}'")
        vector_store.add_documents(chunks)
        print(f"✅ {len(chunks)} chunks uploaded to Pinecone")

        # ✅ SQLite update
        conn = get_connection()
        try:
            conn.execute("DELETE FROM documents WHERE thread_id = ?", (thread_id,))
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

    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        return {"error": f"Processing failed: {str(e)}"}


# ─────────────────────────────────────────────
# 2. Retrieve relevant context for a query
# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
# 2. Retrieve relevant context for a query (UPDATED)
# ─────────────────────────────────────────────
def retrieve_context(thread_id: str, query: str, k: int = 10) -> str:

    # ── Step 1: Broad Query Handling (Enrichment) ─────────────────────
    # If the user asks for a summary or overview, expand the query to find key points.
    generic_keywords = ["summary", "summarize", "explain", "overview", "about",
                        "describe", "tell me", "what is this", "50 words", "100 words",
                        "content", "all content", "brief"]
    
    is_generic = any(kw in query.lower() for kw in generic_keywords)
    if is_generic:
        query = f"{query} introduction main content key points conclusion summary"
        print(f"🔄 Query enriched for better retrieval")

    # ── Step 2: SQLite Metadata Retrieval ─────────────────────────────
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT doc_id, chunk_count FROM documents WHERE thread_id = ?",
            (thread_id,)
        ).fetchall()
        doc_ids = {r["doc_id"] for r in rows}
        total_chunks = sum(r["chunk_count"] for r in rows)
    finally:
        conn.close()

    if not doc_ids:
        print("⚠️ No documents found for this thread.")
        return ""

    # ── Step 3: Adaptive Fetch Strategy ───────────────────────────────
    # For small PDFs or generic queries, fetch more chunks to ensure no context is missed.
    if total_chunks <= 100 or is_generic:
        fetch_k = min(total_chunks, 150)
    else:
        fetch_k = k * 3

    # ── Step 4: Pinecone Search with Score ────────────────────────────
    try:
        # Apply the thread_id filter directly at the Pinecone level for accuracy.
        results_with_scores = vector_store.similarity_search_with_score(
            query,
            k=fetch_k,
            filter={"thread_id": {"$eq": thread_id}}
        )
    except Exception as e:
        print(f"❌ Pinecone retrieval error: {e}")
        return ""

    if not results_with_scores:
        return ""

    # ── Step 5: Sorting & Filtering Logic ─────────────────────────────
    # Sort by page number to maintain logical flow for the LLM.
    results_with_scores.sort(key=lambda x: x[0].metadata.get("page_label", 0))

    # Threshold Adjustment: 
    # For OpenAI embeddings, 0.70 (Generic) and 0.75 (Specific) provide a good balance.
    THRESHOLD = 0.70 if is_generic else 0.75
    
    parts = []
    for doc, score in results_with_scores:
        # Skip filtering for very small PDFs to provide maximum context.
        # Apply threshold for larger documents to reduce noise.
        if total_chunks <= 50 or score >= THRESHOLD:
            page = doc.metadata.get("page_label", "?")
            content = doc.page_content.strip()
            parts.append(f"[Page {page}]: {content}")

    # ── Step 6: Fallback (Avoid "Information Not Found") ──────────────
    # If the threshold was too strict and removed all chunks, use the top 5 results as a backup.
    if not parts and results_with_scores:
        print("⚠️ Using fallback: Threshold was too strict.")
        for doc, _ in results_with_scores[:5]:
            page = doc.metadata.get("page_label", "?")
            parts.append(f"[Page {page}]: {doc.page_content.strip()}")

    print(f"✅ Sent {len(parts)} chunks to LLM.")
    return "\n\n---\n\n".join(parts)

# ─────────────────────────────────────────────
# 3. List documents for a thread
# ─────────────────────────────────────────────
def get_documents_for_thread(thread_id: str) -> List[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT doc_id, thread_id, filename, file_path, chunk_count, uploaded_at
               FROM documents WHERE thread_id = ? ORDER BY uploaded_at ASC""",
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

    try:
        pinecone_index.delete(filter={"doc_id": {"$eq": doc_id}})
        print(f"🗑️  Pinecone vectors deleted for doc_id='{doc_id}'")
    except Exception as e:
        print(f"⚠️  Pinecone delete error: {e}")

    if os.path.exists(meta["file_path"]):
        os.remove(meta["file_path"])

    return {"deleted": doc_id, "filename": meta["filename"]}