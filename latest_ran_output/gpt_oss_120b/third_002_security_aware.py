import os
import hmac
import hashlib
from flask import Flask, request, abort, jsonify

app = Flask(__name__)

# Secret used to compute HMAC (set this env variable securely)
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "change_me_to_a_strong_secret")

# In‑memory store for processed event IDs (replace with persistent storage in prod)
processed_events = set()


def verify_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Verify HMAC‑SHA256 signature.
    Expected header format: sha256=hex_digest
    """
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    received_sig = signature_header.split("=", 1)[1]
    computed_hmac = hmac.new(
        WEBHOOK_SECRET.encode(),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    # Use constant‑time comparison to avoid timing attacks
    return hmac.compare_digest(computed_hmac, received_sig)


def process_event(event_payload: dict):
    """
    Placeholder for actual event handling logic.
    Replace with real processing (e.g., DB updates, async jobs, etc.).
    """
    # Example: just log the payload
    app.logger.info("Processing event: %s", event_payload)


@app.route("/webhook", methods=["POST"])
def webhook_receiver():
    raw_body = request.get_data()
    signature = request.headers.get("X-Hub-Signature-256")  # adjust header name as needed

    if not verify_signature(raw_body, signature):
        abort(401, description="Invalid or missing signature")

    try:
        payload = request.get_json(force=True)
    except Exception:
        abort(400, description="Invalid JSON payload")

    event_id = request.headers.get("X-Event-ID")
    if not event_id:
        abort(400, description="Missing X-Event-ID header")

    # Idempotency check
    if event_id in processed_events:
        return jsonify({"status": "duplicate", "message": "Event already processed"}), 200

    # Process the event
    process_event(payload)

    # Mark as processed
    processed_events.add(event_id)

    return jsonify({"status": "success", "message": "Event processed"}), 200


if __name__ == "__main__":
    # For production, use a proper WSGI server (gunicorn, uWSGI, etc.)
    app.run(host="0.0.0.0", port=5000)