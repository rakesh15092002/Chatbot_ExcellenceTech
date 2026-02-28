# services/chat_services.py
import asyncio
from app.graph import chatbot
from services.document_service import retrieve_context, get_documents_for_thread
from services.thread_services import get_thread_history, save_message
from langchain_core.messages import HumanMessage
from typing import Dict

HISTORY_LIMIT = 20


async def process_chat_message(thread_id: str, message: str) -> Dict[str, str]:
    try:
        # ─────────────────────────────────────────
        # Step 1: Check if PDF exists in this thread
        # ─────────────────────────────────────────
        docs = get_documents_for_thread(thread_id)
        if not docs:
            return {
                "reply":   "⚠️ No PDF found. Please upload a PDF to start a conversation.",
                "rag_used": False,
            }

        # ─────────────────────────────────────────
        # Step 2: Save user message
        # ─────────────────────────────────────────
        save_message(thread_id, "user", message)

        # ─────────────────────────────────────────
        # Step 3: Retrieve relevant chunks from Pinecone
        # ─────────────────────────────────────────
        context = retrieve_context(thread_id, message)

        # ─────────────────────────────────────────
        # Step 4: Determine mode
        # ─────────────────────────────────────────
        #  "pdf"        → context found, LLM will answer from it
        #  "no_context" → PDF exists but no relevant chunk found
        mode = "pdf" if context else "no_context"

        # ─────────────────────────────────────────
        # Step 5: Build message history
        # ─────────────────────────────────────────
        history  = get_thread_history(thread_id, limit=HISTORY_LIMIT)
        messages = history + [HumanMessage(content=message)]

        # ─────────────────────────────────────────
        # Step 6: Run LangGraph
        # ─────────────────────────────────────────
        result_state = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: chatbot.invoke({
                "messages": messages,
                "mode":     mode,
                "context":  context or "",
            })
        )

        ai_reply = result_state["messages"][-1].content

        # ─────────────────────────────────────────
        # Step 7: Save assistant reply
        # ─────────────────────────────────────────
        save_message(thread_id, "assistant", ai_reply)

        return {
            "reply":    ai_reply,
            "rag_used": bool(context),
        }

    except Exception as e:
        return {"error": str(e)}