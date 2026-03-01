from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from services.chat_services import process_chat_message, stream_chat_message
from schemas.chat_schema import ChatRequest, ChatResponse
import json

chat_router = APIRouter()

@chat_router.post("/send")
async def chat_endpoint(request: ChatRequest):
    result = await process_chat_message(request.thread_id, request.message)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return ChatResponse(reply=result["reply"], thread_id=request.thread_id)

# ✅ Streaming endpoint
@chat_router.post("/stream")
async def stream_endpoint(request: ChatRequest):
    async def event_generator():
        async for chunk in stream_chat_message(request.thread_id, request.message):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":      "no-cache",
            "X-Accel-Buffering":  "no",
        }
    )