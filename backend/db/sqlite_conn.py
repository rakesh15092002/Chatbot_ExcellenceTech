import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "ragchatbot.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS threads (
            thread_id   TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            name        TEXT NOT NULL DEFAULT 'New Chat',
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id   TEXT NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
            role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content     TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            doc_id      TEXT PRIMARY KEY,
            thread_id   TEXT NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
            filename    TEXT NOT NULL,
            file_path   TEXT NOT NULL,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            uploaded_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_messages_thread
            ON messages(thread_id, id);

        CREATE INDEX IF NOT EXISTS idx_documents_thread
            ON documents(thread_id);

        CREATE INDEX IF NOT EXISTS idx_threads_user
            ON threads(user_id);
    """)
    conn.commit()
    conn.close()