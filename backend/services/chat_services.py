# services/chat_services.py
import asyncio
from app.graph import chatbot, llm
from services.document_service import retrieve_context, get_documents_for_thread
from services.thread_services import get_thread_history, save_message
from langchain_core.messages import HumanMessage, SystemMessage
from typing import Dict, AsyncGenerator

HISTORY_LIMIT = 20


# ─────────────────────────────────────────────
# Existing — non-streaming
# ─────────────────────────────────────────────
async def process_chat_message(thread_id: str, message: str) -> Dict[str, str]:
    try:
        docs = get_documents_for_thread(thread_id)
        if not docs:
            return {
                "reply":    "⚠️ No PDF found. Please upload a PDF to start a conversation.",
                "rag_used": False,
            }

        save_message(thread_id, "user", message)
        context = retrieve_context(thread_id, message)
        mode    = "pdf" if context else "no_context"
        history = get_thread_history(thread_id, limit=HISTORY_LIMIT)
        messages = history + [HumanMessage(content=message)]

        result_state = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: chatbot.invoke({
                "messages": messages,
                "mode":     mode,
                "context":  context or "",
            })
        )

        ai_reply = result_state["messages"][-1].content
        save_message(thread_id, "assistant", ai_reply)

        return {"reply": ai_reply, "rag_used": bool(context)}

    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# Streaming
# ─────────────────────────────────────────────
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

        print(f"📥 Query: {message}")
        print(f"📄 Context length: {len(context)} chars")
        print(f"📄 Context preview: {context[:300] if context else 'EMPTY'}")

        # Step 4: No context — inform user properly
        if not context:
            filenames = [d["filename"] for d in docs]
            msg = (
                f"⚠️ I couldn't find relevant information for your query in: "
                f"{', '.join(filenames)}. Please try rephrasing."
            )
            yield msg
            save_message(thread_id, "assistant", msg)
            return

        # Step 5: System prompt — IMPROVED
        history = get_thread_history(thread_id, limit=HISTORY_LIMIT)

        system_prompt = SystemMessage(content=(
            "You are an intelligent PDF assistant. Answer questions using the document context below.\n\n"

            "IMPORTANT RULES:\n"
            "1. Use ONLY the information from the DOCUMENT CONTEXT below.\n"
            "2. The context contains extracted text from a PDF — headings, sections, and content are all present.\n"
            "3. If a section heading like 'Abstract', 'Introduction', 'Conclusion' etc. appears in context,\n"
            "   confidently say YES it is present and provide its content directly.\n"
            "4. Do NOT say 'not explicitly mentioned' if the content is clearly there.\n"
            "5. Answer confidently and directly — do not hedge unnecessarily.\n"
            "6. If the answer is truly not in the context, say:\n"
            "   'This information is not available in the uploaded PDF.'\n"
            "7. Do NOT make up information not in the context.\n\n"

            "=== DOCUMENT CONTEXT ===\n"
            f"{context}\n"
            "========================\n\n"

            "Now answer the user's question directly and confidently based on the context above."
        ))

        # Strip old system messages
        clean_history = [m for m in history if not isinstance(m, SystemMessage)]
        final_messages = [system_prompt] + clean_history + [HumanMessage(content=message)]

        # Step 6: Stream tokens
        full_reply = ""
        async for chunk in llm.astream(final_messages):
            token = chunk.content
            if token:
                full_reply += token
                yield token

        # Step 7: Save reply
        save_message(thread_id, "assistant", full_reply)

    except Exception as e:
        yield f"❌ Error: {str(e)}"