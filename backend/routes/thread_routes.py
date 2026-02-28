from fastapi import APIRouter, HTTPException, Header
from services.thread_services import (
    create_thread,
    get_threads,
    get_thread_messages_for_api,
    delete_thread,
)

thread_router = APIRouter()


# POST /thread/?name=xxx
@thread_router.post("/")
def create_thread_api(
    name: str = "New Chat",
    x_user_id: str = Header(..., description="Clerk user ID"),
):
    thread_id = create_thread(name, x_user_id)
    return {"thread_id": thread_id, "name": name}


# GET /thread/thread-all
@thread_router.get("/thread-all")
def list_threads_api(
    x_user_id: str = Header(..., description="Clerk user ID"),
):
    return get_threads(x_user_id)


# GET /thread/{thread_id}/messages
@thread_router.get("/{thread_id}/messages")
def get_thread_messages_api(thread_id: str):
    messages = get_thread_messages_for_api(thread_id)
    return {"thread_id": thread_id, "messages": messages}


# DELETE /thread/{thread_id}
@thread_router.delete("/{thread_id}")
def delete_thread_api(thread_id: str):
    success = delete_thread(thread_id)
    if not success:
        raise HTTPException(status_code=404, detail="Thread not found.")
    return {"message": "Thread deleted ✅", "thread_id": thread_id}