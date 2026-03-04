# app/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI   # ✅ OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(
    model="gpt-4o",
    api_key=os.getenv("OPENAI_API_KEY"),
    temperature=0,  # strict — context se bahar nahi jaayega
)


class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    mode:     str   # "pdf" | "no_pdf" | "no_context"
    context:  str   # RAG context chunks


# ─────────────────────────────────────────────
# Node 1: Router
# ─────────────────────────────────────────────
def router_node(state: ChatState) -> ChatState:
    return state


# ─────────────────────────────────────────────
# Node 2: PDF Chat
# ─────────────────────────────────────────────
def pdf_chat_node(state: ChatState) -> ChatState:
    system_prompt = SystemMessage(content=(
        "You are an intelligent PDF assistant. Answer questions using the document context below.\n\n"
        "RULES:\n"
        "1. Use ONLY the information from the DOCUMENT CONTEXT below.\n"
        "2. The context contains extracted text from a PDF — headings, sections, and content are all present.\n"
        "3. If a section heading like 'Abstract', 'Introduction', 'Conclusion' appears in context,\n"
        "   confidently say YES it is present and provide its content directly.\n"
        "4. Do NOT say 'not explicitly mentioned' if the content is clearly there.\n"
        "5. Answer confidently and directly — do not hedge unnecessarily.\n"
        "6. If the answer is truly not in the context, say:\n"
        "   'This information is not available in the uploaded PDF.'\n"
        "7. Do NOT make up information not in the context.\n\n"
        "=== DOCUMENT CONTEXT ===\n"
        f"{state['context']}\n"
        "=========================\n\n"
        "Now answer the user's question directly and confidently."
    ))

    history = [m for m in state["messages"] if not isinstance(m, SystemMessage)]
    final_messages = [system_prompt] + history

    response = llm.invoke(final_messages)
    return {
        "messages": [response],
        "mode":     state["mode"],
        "context":  state["context"],
    }


# ─────────────────────────────────────────────
# Node 3: No PDF uploaded
# ─────────────────────────────────────────────
def no_pdf_node(state: ChatState) -> ChatState:
    reply = AIMessage(content=(
        "⚠️ No PDF found.\n"
        "Please upload a PDF document first to start a conversation."
    ))
    return {"messages": [reply], "mode": state["mode"], "context": ""}


# ─────────────────────────────────────────────
# Node 4: PDF exists but query not found
# ─────────────────────────────────────────────
def no_context_node(state: ChatState) -> ChatState:
    reply = AIMessage(content=(
        "❌ I don't know. This information is not available in the uploaded PDF."
    ))
    return {"messages": [reply], "mode": state["mode"], "context": ""}


# ─────────────────────────────────────────────
# Conditional routing
# ─────────────────────────────────────────────
def route_by_mode(state: ChatState) -> str:
    mode = state.get("mode", "no_pdf")
    if mode == "pdf":
        return "pdf_chat_node"
    elif mode == "no_context":
        return "no_context_node"
    else:
        return "no_pdf_node"


# ─────────────────────────────────────────────
# Build Graph
# ─────────────────────────────────────────────
graph = StateGraph(state_schema=ChatState)

graph.add_node("router_node",     router_node)
graph.add_node("pdf_chat_node",   pdf_chat_node)
graph.add_node("no_pdf_node",     no_pdf_node)
graph.add_node("no_context_node", no_context_node)

graph.add_edge(START, "router_node")

graph.add_conditional_edges(
    "router_node",
    route_by_mode,
    {
        "pdf_chat_node":   "pdf_chat_node",
        "no_pdf_node":     "no_pdf_node",
        "no_context_node": "no_context_node",
    }
)

graph.add_edge("pdf_chat_node",   END)
graph.add_edge("no_pdf_node",     END)
graph.add_edge("no_context_node", END)

chatbot = graph.compile()