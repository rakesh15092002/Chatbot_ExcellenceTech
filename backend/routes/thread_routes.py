# routes/thread_routes.py
from fastapi import APIRouter, HTTPException

thread_router = APIRouter()

from services.thread_services import (
    create_thread,
    get_threads,
    get_thread_messages_for_api,
    delete_thread,
)


# 1. Create a new thread
# POST /thread/?name=My+Chat
@thread_router.post("/")
def create_thread_api(name: str = "New Chat"):
    thread_id = create_thread(name)
    return {"thread_id": thread_id, "name": name}


# 2. List all threads
# GET /thread/thread-all
@thread_router.get("/thread-all")
def list_threads_api():
    return get_threads()


# 3. Get all messages for a thread
# GET /thread/{thread_id}/messages
@thread_router.get("/{thread_id}/messages")
def get_thread_messages_api(thread_id: str):
    messages = get_thread_messages_for_api(thread_id)
    return {"thread_id": thread_id, "messages": messages}


# 4. Delete a thread and all its messages
# DELETE /thread/{thread_id}
@thread_router.delete("/{thread_id}")
def delete_thread_api(thread_id: str):
    success = delete_thread(thread_id)
    if not success:
        raise HTTPException(status_code=404, detail="Thread not found.")
    return {"message": "Thread deleted ✅", "thread_id": thread_id}