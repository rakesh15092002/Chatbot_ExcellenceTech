# app/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage, AIMessage
from langchain_groq import ChatGroq
import os
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "llama-3.3-70b-versatile"

llm = ChatGroq(
    model=MODEL_NAME,
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.4,
)

class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]  # ✅ use add_messages reducer

graph = StateGraph(state_schema=ChatState)

def chat_node(state: ChatState):
    response = llm.invoke(state["messages"])  # ✅ invoke returns a single AIMessage
    return {"messages": [response]}           # ✅ return dict, not mutated state

graph.add_node("chat_node", chat_node)
graph.add_edge(START, "chat_node")
graph.add_edge("chat_node", END)

chatbot = graph.compile()