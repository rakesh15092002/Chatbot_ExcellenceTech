# services/thread_services.py
import uuid
from datetime import datetime, timezone
from db.sqlite_conn import get_connection    # ✅ correct path


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_thread(name: str = "New Chat") -> str:
    thread_id = str(uuid.uuid4())
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO threads (thread_id, name, created_at) VALUES (?, ?, ?)",
            (thread_id, name, _now()),
        )
        conn.commit()
    finally:
        conn.close()
    return thread_id


def get_threads() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT thread_id, name, created_at FROM threads ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def save_message(thread_id: str, role: str, content: str) -> dict:
    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO messages (thread_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (thread_id, role, content, _now()),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM messages WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


def get_thread_messages_for_api(thread_id: str) -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, role, content, created_at FROM messages "
            "WHERE thread_id = ? ORDER BY id ASC",
            (thread_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_thread_history(thread_id: str, limit: int = 20):
    """Returns last `limit` messages as LangChain message objects."""
    from langchain_core.messages import HumanMessage, AIMessage

    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT role, content FROM messages
            WHERE thread_id = ? AND role IN ('user', 'assistant')
            ORDER BY id DESC LIMIT ?
            """,
            (thread_id, limit),
        ).fetchall()
    finally:
        conn.close()

    rows = list(reversed(rows))   # oldest first for the LLM

    history = []
    for row in rows:
        if row["role"] == "user":
            history.append(HumanMessage(content=row["content"]))
        else:
            history.append(AIMessage(content=row["content"]))
    return history


def delete_thread(thread_id: str) -> bool:
    conn = get_connection()
    try:
        result = conn.execute(
            "DELETE FROM threads WHERE thread_id = ?", (thread_id,)
        )
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()