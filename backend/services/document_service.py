# ─────────────────────────────────────────────
# REQUIRED INSTALLS:
#   pip install pymupdf langchain-community langchain-huggingface
#   pip install langchain-pinecone pinecone-client sentence-transformers python-dotenv
# ─────────────────────────────────────────────

import os
import uuid
from typing import List
from datetime import datetime, timezone

from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
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
EMBEDDING_DIM    = 384

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

# ── Embeddings & VectorStore ──────────────────
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)
vector_store = PineconeVectorStore(
    index=pinecone_index,
    embedding=embeddings,
    text_key="text",
)

# ── Chunking ──────────────────────────────────
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=150,
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

        chunks = text_splitter.split_documents(pages)
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
def retrieve_context(thread_id: str, query: str, k: int = 10) -> str:

    # ── Step 1: SQLite se doc_ids aur chunk_count lo ──────────────────
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT doc_id, chunk_count FROM documents WHERE thread_id = ?",
            (thread_id,)
        ).fetchall()
        doc_ids      = {r["doc_id"] for r in rows}
        total_chunks = sum(r["chunk_count"] for r in rows)
    finally:
        conn.close()

    print(f"🗄️  doc_ids: {doc_ids} | total chunks: {total_chunks}")

    if not doc_ids:
        print("⚠️  No documents found in SQLite for this thread!")
        return ""

    # ── Step 2: Hybrid strategy ───────────────────────────────────────
    # Chhoti PDF  (≤50 chunks)  → poori PDF do LLM ko
    # Badi PDF    (>50 chunks)  → sirf relevant chunks do
    if total_chunks <= 100:
        fetch_k = min(total_chunks + 10, 200)
        print(f"📖 Small PDF — fetching all {fetch_k} chunks")
    else:
        fetch_k = k * 4  # sirf relevant chunks
        print(f"📚 Large PDF — fetching top {fetch_k} relevant chunks")

    # ── Step 3: Pinecone se fetch karo ───────────────────────────────
    try:
        results_with_scores = vector_store.similarity_search_with_score(
            query,
            k=fetch_k,
        )
        print(f"📊 Pinecone fetched: {len(results_with_scores)} chunks")

    except Exception as e:
        print(f"❌ Pinecone retrieval error: {e}")
        return ""

    if not results_with_scores:
        print("⚠️  Pinecone ne koi result nahi diya!")
        return ""

    # ── Step 4: Sirf is thread ke chunks filter karo ─────────────────
    thread_results = [
        (doc, score) for doc, score in results_with_scores
        if doc.metadata.get("doc_id") in doc_ids
        or doc.metadata.get("thread_id") == thread_id
    ]
    print(f"🔍 Matched chunks: {len(thread_results)}/{len(results_with_scores)}")

    if not thread_results:
        print("❌ Koi matching chunk nahi mila!")
        return ""

    # ── Step 5: Page number se sort karo ─────────────────────────────
    def get_page(item):
        try:
            return float(item[0].metadata.get("page_label", 999))
        except:
            return 999

    thread_results.sort(key=get_page)

    # ── Step 6: Chhoti PDF → sab do | Badi PDF → threshold filter ────
    parts = []

    if total_chunks <= 100:
        # Poori PDF — no filtering
        for doc, score in thread_results:
            page    = doc.metadata.get("page_label", "?")
            content = doc.page_content.strip()
            parts.append(f"[Page {page}]: {content}")
    else:
        # Badi PDF — sirf relevant chunks
        SIMILARITY_THRESHOLD = 0.85
        for doc, score in thread_results:
            if score <= SIMILARITY_THRESHOLD:
                page    = doc.metadata.get("page_label", "?")
                content = doc.page_content.strip()
                parts.append(f"[Page {page}]: {content}")

        # Fallback agar kuch na mile
        if not parts:
            for doc, score in thread_results[:k]:
                page    = doc.metadata.get("page_label", "?")
                content = doc.page_content.strip()
                parts.append(f"[Page {page}]: {content}")

    print(f"✅ Total context chunks sent to LLM: {len(parts)}")
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