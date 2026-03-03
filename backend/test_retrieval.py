from services.document_service import retrieve_context
from db.sqlite_conn import get_connection

# Step 1: Sabse latest thread_id nikalo
conn = get_connection()
rows = conn.execute(
    "SELECT thread_id, filename, doc_id FROM documents ORDER BY uploaded_at DESC LIMIT 5"
).fetchall()
conn.close()

print("=== SQLite Documents ===")
for r in rows:
    print(f"thread_id: {r['thread_id']} | file: {r['filename']} | doc_id: {r['doc_id']}")

# Step 2: Latest thread se context retrieve karo
if rows:
    thread_id = rows[0]["thread_id"]
    print(f"\n=== Testing retrieve_context for thread: {thread_id} ===")
    context = retrieve_context(thread_id, "abstract")
    print(f"\nContext length: {len(context)}")
    print(f"Context preview:\n{context[:500]}")