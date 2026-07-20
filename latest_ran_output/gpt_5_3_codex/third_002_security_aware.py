import os
import hmac
import hashlib
import threading
from datetime import datetime
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Configuration
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "change-me")
SIGNATURE_HEADER = os.getenv("WEBHOOK_SIGNATURE_HEADER", "X-Webhook-Signature")
SIGNATURE_PREFIX = os.getenv("WEBHOOK_SIGNATURE_PREFIX", "sha256=")

# In-memory idempotency store (replace with Redis/DB in production)
processed_event_ids = set()
processed_lock = threading.Lock()


def compute_signature(secret: str, payload: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"{SIGNATURE_PREFIX}{digest}"


def is_valid_signature(received_signature: str, payload: bytes) -> bool:
    expected = compute_signature(WEBHOOK_SECRET, payload)
    return hmac.compare_digest(received_signature, expected)


def mark_event_processed(event_id: str) -> bool:
    """
    Returns True if event is newly marked as processed.
    Returns False if event was already processed.
    """
    with processed_lock:
        if event_id in processed_event_ids:
            return False
        processed_event_ids.add(event_id)
        return True


def process_event(event: dict) -> None:
    """
    Placeholder for actual event processing logic.
    """
    event_type = event.get("type")
    event_id = event.get("id")
    print(f"[{datetime.utcnow().isoformat()}] Processing event id={event_id} type={event_type}")


@app.route("/webhook", methods=["POST"])
def webhook():
    raw_body = request.get_data(cache=False, as_text=False)

    signature = request.headers.get(SIGNATURE_HEADER)
    if not signature:
        abort(401, description="Missing signature")

    if not is_valid_signature(signature, raw_body):
        abort(401, description="Invalid signature")

    event = request.get_json(silent=True)
    if not isinstance(event, dict):
        return jsonify({"error": "Invalid JSON payload"}), 400

    event_id = event.get("id")
    if not event_id or not isinstance(event_id, str):
        return jsonify({"error": "Missing or invalid event id"}), 400

    if not mark_event_processed(event_id):
        return jsonify({"status": "duplicate", "event_id": event_id}), 200

    try:
        process_event(event)
    except Exception:
        # Optional: remove event from processed set to allow retry on failure
        with processed_lock:
            processed_event_ids.discard(event_id)
        raise

    return jsonify({"status": "processed", "event_id": event_id}), 200


@app.errorhandler(401)
def unauthorized(e):
    return jsonify({"error": "unauthorized", "message": str(e)}), 401


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))