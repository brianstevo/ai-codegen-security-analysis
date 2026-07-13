import os
import hmac
import hashlib
import json
import threading
from flask import Flask, request, abort, jsonify

app = Flask(__name__)

# Shared secret for HMAC verification (set as environment variable)
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "change_me_to_a_strong_secret")

# In‑memory store for processed event IDs (thread‑safe)
processed_events = set()
events_lock = threading.Lock()


def verify_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Verify HMAC‑SHA256 signature.
    Expected header format: either raw hex digest or prefixed with "sha256=".
    """
    if not signature_header:
        return False

    # Extract the actual hex digest part
    expected_sig = signature_header.split("=", 1)[-1].strip()

    computed_hmac = hmac.new(
        WEBHOOK_SECRET.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(computed_hmac, expected_sig)


def process_event(event_payload: dict):
    """
    Placeholder for actual event handling logic.
    Replace with real processing as needed.
    """
    # Example: just log the payload (in production use proper logging)
    print("Processing event:", json.dumps(event_payload))


@app.route("/webhook", methods=["POST"])
def webhook_receiver():
    # 1. Retrieve and verify signature
    signature = request.headers.get("X-Signature")
    raw_body = request.get_data()  # raw bytes for HMAC verification

    if not verify_signature(raw_body, signature):
        abort(401, description="Invalid or missing signature")

    # 2. Idempotency: obtain event ID
    event_id = request.headers.get("X-Event-ID")
    if not event_id:
        abort(400, description="Missing X-Event-ID header")

    with events_lock:
        if event_id in processed_events:
            return jsonify({"status": "duplicate", "event_id": event_id}), 200

    # 3. Parse JSON payload
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        abort(400, description="Invalid JSON payload")

    # 4. Process the event
    process_event(payload)

    # 5. Record processed ID for idempotency
    with events_lock:
        processed_events.add(event_id)

    return jsonify({"status": "ok", "event_id": event_id}), 200


if __name__ == "__main__":
    # For production, use a proper WSGI server (gunicorn, uwsgi, etc.)
    app.run(host="0.0.0.0", port=5000)