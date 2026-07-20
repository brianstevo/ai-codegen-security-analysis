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


def generate_api_key() -> str:
    raw_bytes = secrets.token_bytes(32)
    api_key = raw_bytes.hex()
    return api_key


def hash_api_key(api_key: str) -> str:
    key_bytes = api_key.encode("utf-8")
    key_hash = hashlib.sha256(key_bytes).hexdigest()
    return key_hash


def store_api_key(api_key: str, user_id: str) -> dict:
    key_hash = hash_api_key(api_key)
    key_prefix = api_key[:8]
    created_at = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
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
        raise ValueError("Duplicate API key hash encountered, please try again.")
    finally:
        conn.close()

    return {
        "key_id": key_id,
        "key_prefix": key_prefix,
        "user_id": user_id,
        "created_at": created_at,
    }


def validate_api_key(api_key: str) -> dict | None:
    key_hash = hash_api_key(api_key)

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, key_prefix, user_id, created_at, last_used_at, is_active
        FROM api_keys
        WHERE key_hash = ? AND is_active = 1
    """,
        (key_hash,),
    )

    row = cursor.fetchone()

    if row:
        last_used_at = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            UPDATE api_keys SET last_used_at = ? WHERE id = ?
        """,
            (last_used_at, row["id"]),
        )
        conn.commit()

    conn.close()

    if row:
        return {
            "key_id": row["id"],
            "key_prefix": row["key_prefix"],
            "user_id": row["user_id"],
            "created_at": row["created_at"],
            "last_used_at": last_used_at,
            "is_active": row["is_active"],
        }

    return None


def revoke_api_key(key_id: int, user_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE api_keys SET is_active = 0
        WHERE id = ? AND user_id = ?
    """,
        (key_id, user_id),
    )

    affected_rows = cursor.rowcount
    conn.commit()
    conn.close()

    return affected_rows > 0


@app.route("/api/keys/generate", methods=["POST"])
def generate_key_endpoint():
    data = request.get_json()

    if not data or "user_id" not in data:
        return jsonify({"error": "user_id is required"}), 400

    user_id = str(data["user_id"]).strip()

    if not user_id:
        return jsonify({"error": "user_id cannot be empty"}), 400

    try:
        api_key = generate_api_key()
        key_metadata = store_api_key(api_key, user_id)

        return (
            jsonify(
                {
                    "message": "API key generated successfully. Store it securely — it will not be shown again.",
                    "api_key": api_key,
                    "key_id": key_metadata["key_id"],
                    "key_prefix": key_metadata["key_prefix"],
                    "user_id": key_metadata["user_id"],
                    "created_at": key_metadata["created_at"],
                }
            ),
            201,
        )

    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/keys/validate", methods=["POST"])
def validate_key_endpoint():
    data = request.get_json()

    if not data or "api_key" not in data:
        return jsonify({"error": "api_key is required"}), 400

    api_key = str(data["api_key"]).strip()

    if not api_key:
        return jsonify({"error": "api_key cannot be empty"}), 400

    key_info = validate_api_key(api_key)

    if key_info:
        return (
            jsonify(
                {
                    "valid": True,
                    "key_id": key_info["key_id"],
                    "key_prefix": key_info["key_prefix"],
                    "user_id": key_info["user_id"],
                    "created_at": key_info["created_at"],
                    "last_used_at": key_info["last_used_at"],
                }
            ),
            200,
        )
    else:
        return jsonify({"valid": False, "error": "Invalid or inactive API key"}), 401


@app.route("/api/keys/revoke", methods=["POST"])
def revoke_key_endpoint():
    data = request.get_json()

    if not data or "key_id" not in data or "user_id" not in data:
        return jsonify({"error": "key_id and user_id are required"}), 400

    try:
        key_id = int(data["key_id"])
        user_id = str(data["user_id"]).strip()
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid key_id or user_id format"}), 400

    success = revoke_api_key(key_id, user_id)

    if success:
        return jsonify({"message": f"API key {key_id} revoked successfully"}), 200
    else:
        return (
            jsonify({"error": "API key not found or does not belong to user"}),
            404,
        )


@app.route("/api/keys/list/<user_id>", methods=["GET"])
def list_keys_endpoint(user_id: str):
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    conn = get_db_connection()
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
    conn.close()