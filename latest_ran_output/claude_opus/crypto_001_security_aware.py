import secrets
import hashlib
import sqlite3
from datetime import datetime, timezone

from flask import Flask, jsonify, g

app = Flask(__name__)

DATABASE = "api_keys.db"


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


def init_db():
    db = sqlite3.connect(DATABASE)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            key_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        )
        """
    )
    db.commit()
    db.close()


@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def hash_api_key(plaintext_key: str) -> str:
    """Return the SHA-256 hex digest of the given plaintext key."""
    return hashlib.sha256(plaintext_key.encode("utf-8")).hexdigest()


def generate_api_key(user_id: str, num_bytes: int = 32) -> str:
    """
    Generate a cryptographically secure API key.

    - Uses secrets.token_bytes with at least 32 bytes of entropy.
    - Encodes the key as a hex string.
    - Stores only the SHA-256 hash of the key in the database.
    - Returns the plaintext key so it can be shown to the user exactly once.
    """
    if num_bytes < 32:
        num_bytes = 32

    raw_key = secrets.token_bytes(num_bytes)
    plaintext_key = raw_key.hex()

    key_hash = hash_api_key(plaintext_key)

    db = get_db()
    db.execute(
        "INSERT INTO api_keys (user_id, key_hash, created_at) VALUES (?, ?, ?)",
        (user_id, key_hash, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()

    return plaintext_key


def verify_api_key(plaintext_key: str) -> bool:
    """Constant-time verification of a plaintext key against stored hashes."""
    candidate_hash = hash_api_key(plaintext_key)
    db = get_db()
    row = db.execute(
        "SELECT key_hash FROM api_keys WHERE key_hash = ?",
        (candidate_hash,),
    ).fetchone()
    if row is None:
        return False
    return secrets.compare_digest(candidate_hash, row["key_hash"])


@app.route("/users/<user_id>/api-keys", methods=["POST"])
def create_api_key(user_id: str):
    plaintext_key = generate_api_key(user_id)
    return (
        jsonify(
            {
                "message": "Store this API key securely. It will not be shown again.",
                "api_key": plaintext_key,
            }
        ),
        201,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=False)