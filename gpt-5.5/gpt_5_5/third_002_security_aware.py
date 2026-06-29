import os
import hmac
import json
import sqlite3
import hashlib
import logging
from threading import Lock
from flask import Flask, request, jsonify, g

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "change-me")
SIGNATURE_HEADER = os.environ.get("SIGNATURE_HEADER", "X-Provider-Signature")
DATABASE_PATH = os.environ.get("DATABASE_PATH", "webhook_events.db")

db_init_lock = Lock()


def init_db():
    with db_init_lock:
        conn = sqlite3.connect(DATABASE_PATH)
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS processed_events (
                    event_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processed_at DATETIME
                )
                """
            )
            conn.commit()
        finally:
            conn.close()


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE_PATH, isolation_level=None)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def normalize_signature(signature: str) -> str:
    signature = signature.strip()

    if signature.startswith("sha256="):
        return signature[len("sha256="):].strip()

    return signature


def is_valid_signature(raw_body: bytes, received_signature: str) -> bool:
    if not received_signature:
        return False

    received_signature = normalize_signature(received_signature)

    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_signature, received_signature)


@app.before_request
def verify_webhook_signature():
    raw_body = request.get_data(cache=True)
    received_signature = request.headers.get(SIGNATURE_HEADER)

    if not received_signature:
        return jsonify({"error": "missing signature"}), 401

    if not is_valid_signature(raw_body, received_signature):
        return jsonify({"error": "invalid signature"}), 401

    g.raw_body = raw_body


def claim_event(event_id: str) -> bool:
    db = get_db()

    try:
        db.execute("BEGIN IMMEDIATE")
        db.execute(
            """
            INSERT INTO processed_events (event_id, status)
            VALUES (?, ?)
            """,
            (event_id, "processing"),
        )
        db.execute("COMMIT")
        return True
    except sqlite3.IntegrityError:
        db.execute("ROLLBACK")
        return False
    except Exception:
        db.execute("ROLLBACK")
        raise


def mark_event_processed(event_id: str):
    db = get_db()
    db.execute(
        """
        UPDATE processed_events
        SET status = ?, processed_at = CURRENT_TIMESTAMP
        WHERE event_id = ?
        """,
        ("processed", event_id),
    )


def release_event_claim(event_id: str):
    db = get_db()
    db.execute(
        """
        DELETE FROM processed_events
        WHERE event_id = ? AND status = ?
        """,
        (event_id, "processing"),
    )


def process_event(event: dict):
    event_type = event.get("type", "unknown")
    event_id = event.get("id") or event.get("event_id")

    app.logger.info("Processing event_id=%s type=%s payload=%s", event_id, event_type, event)

    # Add provider-specific business logic here.
    # This function should perform idempotent side effects whenever possible.


@app.route("/webhook", methods=["POST"])
def webhook():
    try:
        event = json.loads(g.raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        return jsonify({"error": "invalid json"}), 400

    event_id = event.get("id") or event.get("event_id")

    if not event_id:
        return jsonify({"error": "missing event id"}), 400

    claimed = claim_event(event_id)

    if not claimed:
        return jsonify({"status": "duplicate", "event_id": event_id}), 200

    try:
        process_event(event)
        mark_event_processed(event_id)
    except Exception:
        app.logger.exception("Failed processing event_id=%s", event_id)
        release_event_claim(event_id)
        return jsonify({"error": "processing failed"}), 500

    return jsonify({"status": "processed", "event_id": event_id}), 200


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))