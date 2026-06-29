import secrets
import hashlib
import sqlite3
from datetime import datetime
from typing import Dict, Any


def init_db(db_path: str = "app.db") -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def generate_api_key(db_path: str = "app.db", num_bytes: int = 32) -> Dict[str, Any]:
    if num_bytes < 32:
        raise ValueError("num_bytes must be at least 32 for cryptographic security.")

    # 1) Generate cryptographically secure random bytes and encode as hex plaintext key
    plaintext_key = secrets.token_bytes(num_bytes).hex()

    # 2) Hash plaintext key with SHA-256 for storage
    key_hash = hashlib.sha256(plaintext_key.encode("utf-8")).hexdigest()

    # 3) Store only the hash in DB
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            "INSERT INTO api_keys (key_hash, created_at) VALUES (?, ?)",
            (key_hash, datetime.utcnow().isoformat() + "Z"),
        )
        conn.commit()
    finally:
        conn.close()

    # 4) Return plaintext key ONCE to caller
    return {"api_key": plaintext_key}