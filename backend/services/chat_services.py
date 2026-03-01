# services/chat_services.py
import asyncio
from app.graph import chatbot, llm
from services.document_service import retrieve_context, get_documents_for_thread
from services.thread_services import get_thread_history, save_message
from langchain_core.messages import HumanMessage, SystemMessage
from typing import Dict, AsyncGenerator

HISTORY_LIMIT = 20


# ─────────────────────────────────────────
# Existing — non-streaming
# ─────────────────────────────────────────
async def process_chat_message(thread_id: str, message: str) -> Dict[str, str]:
    try:
        # Step 1: Check if PDF exists
        docs = get_documents_for_thread(thread_id)
        if not docs:
            return {
                "reply":    "⚠️ No PDF found. Please upload a PDF to start a conversation.",
                "rag_used": False,
            }

        # Step 2: Save user message
        save_message(thread_id, "user", message)

        # Step 3: Retrieve context
        context = retrieve_context(thread_id, message)

        # Step 4: Determine mode
        mode = "pdf" if context else "no_context"

        # Step 5: Build history
        history  = get_thread_history(thread_id, limit=HISTORY_LIMIT)
        messages = history + [HumanMessage(content=message)]

        # Step 6: Run LangGraph
        result_state = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: chatbot.invoke({
                "messages": messages,
                "mode":     mode,
                "context":  context or "",
            })
        )

        ai_reply = result_state["messages"][-1].content

        # Step 7: Save reply
        save_message(thread_id, "assistant", ai_reply)

        return {
            "reply":    ai_reply,
            "rag_used": bool(context),
        }

    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────
# ✅ NEW — Streaming
# ─────────────────────────────────────────
async def stream_chat_message(thread_id: str, message: str) -> AsyncGenerator[str, None]:
    try:
        # Step 1: Check PDF
        docs = get_documents_for_thread(thread_id)
        if not docs:
            yield "⚠️ No PDF found. Please upload a PDF to start a conversation."
            return

        # Step 2: Save user message
        save_message(thread_id, "user", message)

        # Step 3: Retrieve context
        context = retrieve_context(thread_id, message)
        mode    = "pdf" if context else "no_context"

        # Step 4: If no context — return fixed message
        if mode == "no_context":
            msg = "❌ I don't know. This information is not available in the uploaded PDF."
            yield msg
            save_message(thread_id, "assistant", msg)
            return

        # Step 5: Build history + system prompt
        history = get_thread_history(thread_id, limit=HISTORY_LIMIT)

        system_prompt = SystemMessage(content=(
            "You are a strict PDF assistant. Your ONLY job is to answer questions "
            "using the document context provided below.\n\n"
            "STRICT RULES you must NEVER break:\n"
            "1. ONLY use information from the DOCUMENT CONTEXT below.\n"
            "2. NEVER use your general training knowledge.\n"
            "3. NEVER make up or infer information not explicitly in the context.\n"
            "4. If the answer is not found in the context, respond EXACTLY with:\n"
            "   'I don't know. This information is not available in the uploaded PDF.'\n"
            "5. Do not apologize, speculate, or add extra commentary.\n\n"
            "=== DOCUMENT CONTEXT ===\n"
            f"{context}\n"
            "=========================\n\n"
            "Answer strictly from the context above."
        ))

        # ✅ Strip old system messages from history
        clean_history = [m for m in history if not isinstance(m, SystemMessage)]
        final_messages = [system_prompt] + clean_history + [HumanMessage(content=message)]

        # Step 6: ✅ Stream tokens from OpenAI
        full_reply = ""

        async for chunk in llm.astream(final_messages):
            token = chunk.content
            if token:
                full_reply += token
                yield token   # ✅ stream each token to frontend

        # Step 7: Save full reply to DB
        save_message(thread_id, "assistant", full_reply)

    except Exception as e:
        yield f"❌ Error: {str(e)}"