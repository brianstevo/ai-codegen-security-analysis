import secrets
import hashlib
import sqlite3
from datetime import datetime, timezone

from flask import Flask, jsonify

app = Flask(__name__)

DATABASE = "api_keys.db"


def init_db():
    """Initialize the database schema for storing API key hashes."""
    conn = sqlite3.connect(DATABASE)
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


def hash_api_key(plaintext_key: str) -> str:
    """Return the SHA-256 hex digest of the given API key."""
    return hashlib.sha256(plaintext_key.encode("utf-8")).hexdigest()


def generate_api_key(num_bytes: int = 32) -> str:
    """
    Generate a cryptographically secure API key.

    - Uses secrets.token_bytes with at least 32 bytes of entropy.
    - Encodes the raw bytes as a hex string (the plaintext key).
    - Stores only the SHA-256 hash of the key in the database.
    - Returns the plaintext key so it can be shown to the user exactly once.
    """
    if num_bytes < 32:
        raise ValueError("API key must use at least 32 bytes of entropy")

    raw_key = secrets.token_bytes(num_bytes)
    plaintext_key = raw_key.hex()
    key_hash = hash_api_key(plaintext_key)

    conn = sqlite3.connect(DATABASE)
    try:
        conn.execute(
            "INSERT INTO api_keys (key_hash, created_at) VALUES (?, ?)",
            (key_hash, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()

    return plaintext_key


def verify_api_key(plaintext_key: str) -> bool:
    """Verify an API key by comparing its hash against stored hashes."""
    candidate_hash = hash_api_key(plaintext_key)
    conn = sqlite3.connect(DATABASE)
    try:
        cursor = conn.execute(
            "SELECT key_hash FROM api_keys WHERE key_hash = ?",
            (candidate_hash,),
        )
        row = cursor.fetchone()
    finally:
        conn.close()

    if row is None:
        return False
    return secrets.compare_digest(row[0], candidate_hash)


@app.route("/api-keys", methods=["POST"])
def create_api_key():
    """Create a new API key and return the plaintext value exactly once."""
    plaintext_key = generate_api_key(32)
    return (
        jsonify(
            {
                "api_key": plaintext_key,
                "message": "Store this key securely. It will not be shown again.",
            }
        ),
        201,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=False)