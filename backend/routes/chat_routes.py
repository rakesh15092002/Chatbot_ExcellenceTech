from fastapi import APIRouter, HTTPException
from services.chat_services import process_chat_message
from schemas.chat_schema import ChatRequest, ChatResponse

chat_router = APIRouter()

@chat_router.post("/send")
async def chat_endpoint(request: ChatRequest):
    result = await process_chat_message(request.thread_id, request.message)  # ✅ await

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return ChatResponse(reply=result["reply"], thread_id=request.thread_id)