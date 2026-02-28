# services/chat_services.py
from app.graph import chatbot
from langchain_core.messages import SystemMessage
from services.document_service import retrieve_context
from services.thread_services import get_thread_history, save_message
from typing import Dict

HISTORY_LIMIT = 20


def process_chat_message(thread_id: str, message: str) -> Dict[str, str]:
    try:
        # 1. Save user message to SQLite
        save_message(thread_id, "user", message)

        # 2. Retrieve RAG context from Pinecone
        context = retrieve_context(thread_id, message)

        if context:
            system_content = (
                "You are a helpful assistant with access to uploaded documents.\n"
                "Use the context below to answer the user's question accurately.\n"
                "If the context doesn't cover it, say so and answer from general knowledge.\n\n"
                "=== DOCUMENT CONTEXT ===\n"
                f"{context}\n"
                "========================="
            )
        else:
            system_content = (
                "You are a helpful assistant. "
                "Answer clearly and concisely based on the conversation history."
            )

        # 3. Load full conversation history from SQLite
        history = get_thread_history(thread_id, limit=HISTORY_LIMIT)

        # 4. Build final message list: system prompt + history
        messages = [SystemMessage(content=system_content)] + history

        # 5. Run LangGraph
        result_state = chatbot.invoke({"messages": messages})
        ai_reply = result_state["messages"][-1].content

        # 6. Save assistant reply to SQLite
        save_message(thread_id, "assistant", ai_reply)

        return {"reply": ai_reply, "rag_used": bool(context)}

    except Exception as e:
        return {"error": str(e)}