```python
import hashlib
import secrets
from datetime import datetime, timezone
from flask import Flask, jsonify, request
import sqlite3
import os

app = Flask(__name__)

DATABASE = "api_keys.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_hash TEXT NOT NULL UNIQUE,
            key_prefix TEXT NOT NULL,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_used_at TEXT,
            is_active INTEGER NOT NULL DEFAULT 1
        )
    """
    )
    conn.commit()
    conn.close()


def generate_api_key(user_id: str) -> dict:
    """
    Generates a cryptographically secure API key.

    - Uses secrets.token_bytes(32) for 32 bytes (256 bits) of randomness
    - Encodes as hex string (64 hex characters)
    - Stores only SHA-256 hash in the database
    - Returns the plaintext key once to the caller

    Args:
        user_id: The identifier of the user the key belongs to

    Returns:
        dict containing the plaintext api_key and metadata
    """
    # Generate 32 cryptographically secure random bytes
    raw_bytes = secrets.token_bytes(32)

    # Encode as hex string (results in a 64-character hex string)
    plaintext_key = raw_bytes.hex()

    # Add a recognizable prefix for easier identification
    prefixed_key = f"sk_{plaintext_key}"

    # Extract a non-sensitive prefix for display/identification purposes
    key_prefix = prefixed_key[:10] + "..."

    # Hash the full key using SHA-256 for secure storage
    key_hash = hashlib.sha256(prefixed_key.encode("utf-8")).hexdigest()

    # Store only the hash in the database
    created_at = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO api_keys (key_hash, key_prefix, user_id, created_at, is_active)
            VALUES (?, ?, ?, ?, 1)
        """,
            (key_hash, key_prefix, user_id, created_at),
        )
        conn.commit()
        key_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise ValueError("API key collision detected. Please try again.")
    finally:
        conn.close()

    # Return the plaintext key ONCE — it will never be retrievable again
    return {
        "api_key": prefixed_key,
        "key_id": key_id,
        "key_prefix": key_prefix,
        "user_id": user_id,
        "created_at": created_at,
        "message": "Store this API key securely. It will not be shown again.",
    }


def verify_api_key(provided_key: str) -> dict | None:
    """
    Verifies a provided API key against stored hashes.

    Args:
        provided_key: The plaintext API key provided by the user

    Returns:
        dict with key metadata if valid and active, None otherwise
    """
    if not provided_key or not isinstance(provided_key, str):
        return None

    # Hash the provided key and compare against stored hashes
    provided_hash = hashlib.sha256(provided_key.encode("utf-8")).hexdigest()

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, key_prefix, user_id, created_at, last_used_at, is_active
            FROM api_keys
            WHERE key_hash = ? AND is_active = 1
        """,
            (provided_hash,),
        )
        row = cursor.fetchone()

        if row:
            # Update last_used_at timestamp
            now = datetime.now(timezone.utc).isoformat()
            cursor.execute(
                "UPDATE api_keys SET last_used_at = ? WHERE id = ?", (now, row["id"])
            )
            conn.commit()
            return {
                "key_id": row["id"],
                "key_prefix": row["key_prefix"],
                "user_id": row["user_id"],
                "created_at": row["created_at"],
                "last_used_at": now,
            }
        return None
    finally:
        conn.close()


def revoke_api_key(key_id: int, user_id: str) -> bool:
    """
    Revokes an API key by marking it as inactive.

    Args:
        key_id: The database ID of the key to revoke
        user_id: The user ID for ownership verification

    Returns:
        True if revoked successfully, False otherwise
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE api_keys SET is_active = 0
            WHERE id = ? AND user_id = ?
        """,
            (key_id, user_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def list_api_keys(user_id: str) -> list:
    """
    Lists all API keys for a user (without exposing hashes or plaintext keys).

    Args:
        user_id: The user ID to list keys for

    Returns:
        List of key metadata dicts
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, key_prefix, user_id, created_at, last_used_at, is_active
            FROM api_keys
            WHERE user_id = ?
            ORDER BY created_at DESC
        """,
            (user_id,),
        )
        rows = cursor.fetchall()
        return [
            {
                "key_id": row["id"],
                "key_prefix": row["key_prefix"],
                "user_id": row["user_id"],
                "created_at": row["created_at"],
                "last_used_at": row["last_used_at"],
                "is_active": bool(row["is_active"]),
            }
            for row in rows
        ]
    finally:
        conn.close()


# ── Flask Routes ──────────────────────────────────────────────────────────────


@app.route("/api/keys/generate", methods=["POST"])
def route_generate_key():
    """Generate a new API key for a user."""
    data = request.get_json()
    if not data or "user_id" not in data:
        return jsonify({"error": "user_id is required"}), 400

    user_id = str(data["user_id"]).strip()
    if not user_id:
        return jsonify({"error": "user_id cannot be empty"}), 400

    try:
        result = generate_api_key(user_id)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/keys/verify", methods=["POST"])
def route_verify_key():
    """Verify an API key."""
    data = request.get_json()
    if not data or "api_key" not in data:
        return jsonify({"error": "api_key is required"}), 400

    key_data = verify_api_key(data["api_key"])
    if key_data:
        return jsonify({"valid": True, "key_data": key_data}), 200
    return jsonify({"valid": False, "error": "Invalid or inactive API key"}), 401


@app.route