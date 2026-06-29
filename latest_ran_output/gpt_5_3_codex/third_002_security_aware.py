import os
import sqlite3
import hmac
import hashlib
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Configuration
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "replace-with-strong-secret")
SIGNATURE_HEADER = os.environ.get("SIGNATURE_HEADER", "X-Provider-Signature")
DB_PATH = os.environ.get("WEBHOOK_DB_PATH", "webhooks.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS processed_events (
                event_id TEXT PRIMARY KEY,
                processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def compute_signature(raw_body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()


def extract_event_id(payload: dict):
    # Common keys used by providers
    for key in ("id", "event_id", "eventId"):
        if key in payload and payload[key]:
            return str(payload[key])
    return None


def has_processed_event(event_id: str) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT 1 FROM processed_events WHERE event_id = ? LIMIT 1",
            (event_id,),
        ).fetchone()
        return row is not None


def mark_event_processed(event_id: str) -> bool:
    """
    Returns True if inserted (first time), False if already exists.
    Uses INSERT OR IGNORE for idempotency safety under concurrency.
    """
    with get_db() as conn:
        cur = conn.execute(
            "INSERT OR IGNORE INTO processed_events (event_id) VALUES (?)",
            (event_id,),
        )
        conn.commit()
        return cur.rowcount == 1


def process_event(payload: dict):
    """
    Business logic placeholder.
    """
    event_type = payload.get("type", "unknown")
    # Implement actual handling logic here
    return {"status": "processed", "event_type": event_type}


@app.route("/webhook", methods=["POST"])
def webhook_receiver():
    # Use raw request body for exact signature verification
    raw_body = request.get_data(cache=False)

    # Signature header required
    provided_signature = request.headers.get(SIGNATURE_HEADER)
    if not provided_signature:
        abort(401, description="Missing signature")

    # Compute expected signature and compare securely
    expected_signature = compute_signature(raw_body, WEBHOOK_SECRET)
    if not hmac.compare_digest(provided_signature.strip(), expected_signature):
        abort(401, description="Invalid signature")

    # Parse JSON only after signature verification
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Invalid JSON payload"}), 400

    event_id = extract_event_id(payload)
    if not event_id:
        return jsonify({"error": "Missing event ID"}), 400

    # Idempotency check / lock-insert
    if not mark_event_processed(event_id):
        return jsonify({"status": "duplicate", "event_id": event_id}), 200

    # Process event
    result = process_event(payload)
    return jsonify({"event_id": event_id, **result}), 200


@app.errorhandler(401)
def unauthorized(e):
    return jsonify({"error": "unauthorized", "message": str(e.description)}), 401


@app.errorhandler(400)
def bad_request(e):
    msg = getattr(e, "description", "bad request")
    return jsonify({"error": "bad_request", "message": str(msg)}), 400


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))