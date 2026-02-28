# routes/documents_routes.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from services.document_service import (
    process_pdf,
    get_documents_for_thread,
    delete_document,
)

documents_router = APIRouter()

ALLOWED_TYPES  = {"application/pdf"}
MAX_SIZE_MB    = 20


# ─────────────────────────────────────────────
# POST /documents/upload?thread_id=xxx
# ─────────────────────────────────────────────
@documents_router.post("/upload")
async def upload_document(
    thread_id: str = Query(..., description="Thread to attach this PDF to"),
    file: UploadFile = File(...),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF files are supported. Received: {file.content_type}",
        )

    file_bytes = await file.read()
    size_mb    = len(file_bytes) / (1024 * 1024)

    if size_mb > MAX_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({size_mb:.1f} MB). Max: {MAX_SIZE_MB} MB.",
        )

    result = process_pdf(
        thread_id  = thread_id,
        file_bytes = file_bytes,
        filename   = file.filename or "document.pdf",
    )

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return {
        "message":   "Document uploaded and indexed into Pinecone ✅",
        "thread_id": thread_id,
        **result,
    }


# ─────────────────────────────────────────────
# GET /documents/?thread_id=xxx
# ─────────────────────────────────────────────
@documents_router.get("/")
def list_documents(thread_id: str = Query(...)):
    docs = get_documents_for_thread(thread_id)
    return {"thread_id": thread_id, "documents": docs, "count": len(docs)}


# ─────────────────────────────────────────────
# DELETE /documents/{doc_id}
# ─────────────────────────────────────────────
@documents_router.delete("/{doc_id}")
def delete_doc(doc_id: str):
    result = delete_document(doc_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return {"message": "Document deleted from Pinecone ✅", **result}