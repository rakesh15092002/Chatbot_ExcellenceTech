# app/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage, AIMessage, SystemMessage
from langchain_groq import ChatGroq
import os
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "llama-3.3-70b-versatile"

llm = ChatGroq(
    model=MODEL_NAME,
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0,  # ✅ 0 = strict, no creativity, stick to context only
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
# Node 2: PDF Chat — strict PDF-only answers
# ─────────────────────────────────────────────
def pdf_chat_node(state: ChatState) -> ChatState:
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
        f"{state['context']}\n"
        "=========================\n\n"
        "Answer strictly from the context above."
    ))

    # Strip any old system messages from history
    history = [m for m in state["messages"] if not isinstance(m, SystemMessage)]
    final_messages = [system_prompt] + history

    response = llm.invoke(final_messages)
    return {
        "messages": [response],
        "mode":     state["mode"],
        "context":  state["context"]
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
# Node 4: PDF exists but query not found in it
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