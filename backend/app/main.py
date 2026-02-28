# app/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager

from db.sqlite_conn import init_db           # ✅ correct path
from routes.chat_routes import chat_router
from routes.thread_routes import thread_router
from routes.documents_routes import documents_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("✅ SQLite initialized → ragchatbot.db")
    yield


app = FastAPI(title="RAG Chatbot API 🤖", lifespan=lifespan)


@app.get("/")
def home():
    return {"message": "RAG Chatbot running 🚀"}


app.include_router(chat_router,      prefix="/chat",      tags=["Chat"])
app.include_router(thread_router,    prefix="/thread",    tags=["Thread"])
app.include_router(documents_router, prefix="/documents", tags=["Documents"])