import os
import hmac
import hashlib
import json
import logging
from typing import Any, Dict, Optional

from flask import Flask, request, jsonify, abort

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "").encode("utf-8")

# In-memory idempotency store for demo purposes.
# Replace with a persistent datastore (Redis/DB) in production.
PROCESSED_EVENT_IDS = set()


def verify_signature(raw_body: bytes, provided_signature: str) -> bool:
    """
    Verify HMAC-SHA256 signature against the raw request body.
    Expected signature format: hex digest string.
    """
    if not WEBHOOK_SECRET:
        logging.error("WEBHOOK_SECRET is not configured")
        return False

    expected = hmac.new(WEBHOOK_SECRET, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided_signature.strip())


def get_signature_from_headers() -> Optional[str]:
    """
    Accept common signature header names.
    Adjust to match your provider's exact header name.
    """
    return (
        request.headers.get("X-Signature")
        or request.headers.get("X-Hub-Signature-256")
        or request.headers.get("X-Webhook-Signature")
    )


def extract_event_id(payload: Dict[str, Any]) -> Optional[str]:
    """
    Extract event ID from common fields.
    Adjust to match your provider's payload schema.
    """
    return (
        payload.get("event_id")
        or payload.get("id")
        or payload.get("eventId")
        or payload.get("event", {}).get("id")
    )


def process_event(payload: Dict[str, Any]) -> None:
    """
    Replace with your actual business logic.
    """
    event_id = extract_event_id(payload)
    logging.info("Processing event %s: %s", event_id, payload)


@app.route("/webhook", methods=["POST"])
def webhook_receiver():
    raw_body = request.get_data(cache=False, as_text=False)
    signature = get_signature_from_headers()

    if not signature:
        abort(401)

    if not verify_signature(raw_body, signature):
        abort(401)

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return jsonify({"error": "Invalid JSON"}), 400

    event_id = extract_event_id(payload)
    if not event_id:
        return jsonify({"error": "Missing event ID"}), 400

    # Idempotent processing: skip already processed events.
    if event_id in PROCESSED_EVENT_IDS:
        logging.info("Duplicate event ignored: %s", event_id)
        return jsonify({"status": "duplicate_ignored", "event_id": event_id}), 200

    # Mark as processed before/after processing depending on your failure semantics.
    # For demo simplicity, we mark after successful processing.
    try:
        process_event(payload)
        PROCESSED_EVENT_IDS.add(event_id)
    except Exception as exc:
        logging.exception("Failed to process event %s: %s", event_id, exc)
        return jsonify({"error": "Processing failed"}), 500

    return jsonify({"status": "ok", "event_id": event_id}), 200


@app.errorhandler(401)
def unauthorized(_):
    return jsonify({"error": "Unauthorized"}), 401


@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "Not found"}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))