# routes/documents_routes.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from services.document_service import (
    process_pdf,
    get_documents_for_thread,
    delete_document,
)

documents_router = APIRouter()

ALLOWED_TYPES = {"application/pdf"}
MAX_SIZE_MB   = 20


# ─────────────────────────────────────────────
# POST /documents/upload?thread_id=xxx
# ─────────────────────────────────────────────
@documents_router.post("/upload")
async def upload_document(
    thread_id: str = Query(..., description="Thread to attach this PDF to"),
    file: UploadFile = File(...),
):
    # ✅ Check 1: File type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "toast":   "error",
                "message": f"❌ Invalid file type. Only PDF files are supported.",
            }
        )

    file_bytes = await file.read()
    size_mb    = len(file_bytes) / (1024 * 1024)

    # ✅ Check 2: File size
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "toast":   "error",
                "message": f"❌ File too large ({size_mb:.1f} MB). Maximum allowed size is {MAX_SIZE_MB} MB.",
            }
        )

    # ✅ Check 3: Empty file
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "toast":   "error",
                "message": "❌ Uploaded file is empty. Please upload a valid PDF.",
            }
        )

    result = process_pdf(
        thread_id  = thread_id,
        file_bytes = file_bytes,
        filename   = file.filename or "document.pdf",
    )

    # ✅ Check 4: Processing error (scanned/image PDF with no text)
    if "error" in result:
        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "toast":   "error",
                "message": f"❌ {result['error']}",
            }
        )

    # ✅ Success
    return {
        "success":        True,
        "toast":          "success",
        "message":        f"✅ '{file.filename}' uploaded and indexed successfully!",
        "thread_id":      thread_id,
        "doc_id":         result["doc_id"],
        "filename":       result["filename"],
        "chunks_indexed": result["chunks_indexed"],
    }


# ─────────────────────────────────────────────
# GET /documents/?thread_id=xxx
# ─────────────────────────────────────────────
@documents_router.get("/")
def list_documents(thread_id: str = Query(...)):
    docs = get_documents_for_thread(thread_id)
    return {
        "success":   True,
        "thread_id": thread_id,
        "documents": docs,
        "count":     len(docs),
    }


# ─────────────────────────────────────────────
# DELETE /documents/{doc_id}
# ─────────────────────────────────────────────
@documents_router.delete("/{doc_id}")
def delete_doc(doc_id: str):
    result = delete_document(doc_id)

    if "error" in result:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "toast":   "error",
                "message": f"❌ Document not found.",
            }
        )

    return {
        "success":  True,
        "toast":    "success",
        "message":  f"✅ '{result['filename']}' deleted successfully!",
        **result,
    }