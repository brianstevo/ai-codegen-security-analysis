import hmac
import hashlib
import os
import threading
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Secret shared with the webhook provider (set via environment variable).
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "").encode("utf-8")

# Header the provider uses to send the signature. Adjust to match your provider.
SIGNATURE_HEADER = "X-Signature-256"

# In-memory store of processed event IDs for idempotency.
# For production, back this with a persistent store (e.g. Redis or a DB).
_processed_event_ids = set()
_processed_lock = threading.Lock()


def _extract_signature(header_value):
    """
    Extract the hex digest from the signature header.
    Supports both raw hex and 'sha256=<hex>' formats.
    """
    if not header_value:
        return None
    header_value = header_value.strip()
    if "=" in header_value:
        scheme, _, value = header_value.partition("=")
        if scheme.lower() != "sha256":
            return None
        return value.strip()
    return header_value


def verify_signature(raw_body, provided_signature):
    """
    Compute the expected HMAC-SHA256 over the raw request body and compare
    it against the provided signature using a constant-time comparison.
    """
    if not WEBHOOK_SECRET:
        # Refuse to verify if no secret is configured.
        return False
    if not provided_signature:
        return False

    expected = hmac.new(WEBHOOK_SECRET, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided_signature)


def already_processed(event_id):
    with _processed_lock:
        return event_id in _processed_ids_view()


def _processed_ids_view():
    return _processed_event_ids


def mark_processed(event_id):
    """
    Atomically mark an event as processed. Returns True if this call
    was the first to mark it (i.e., it should be processed now),
    False if it was already present (duplicate).
    """
    with _processed_lock:
        if event_id in _processed_event_ids:
            return False
        _processed_event_ids.add(event_id)
        return True


def handle_event(event):
    """
    Business logic for processing a validated, non-duplicate event.
    Replace with real handling.
    """
    event_type = event.get("type", "unknown")
    app.logger.info("Processing event id=%s type=%s", event.get("id"), event_type)
    # ... perform side effects here ...


@app.route("/webhook", methods=["POST"])
def webhook():
    # Read the raw body exactly as received for signature verification.
    raw_body = request.get_data()

    provided_signature = _extract_signature(request.headers.get(SIGNATURE_HEADER))
    if provided_signature is None:
        app.logger.warning("Missing webhook signature")
        abort(401, description="Missing signature")

    if not verify_signature(raw_body, provided_signature):
        app.logger.warning("Invalid webhook signature")
        abort(401, description="Invalid signature")

    # Signature is valid; now parse the payload.
    try:
        import json
        event = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        abort(400, description="Invalid JSON payload")

    if not isinstance(event, dict):
        abort(400, description="Payload must be a JSON object")

    event_id = event.get("id")
    if not event_id:
        abort(400, description="Missing event id")

    # Idempotency: only process the first time we see this event id.
    if not mark_processed(str(event_id)):
        app.logger.info("Duplicate event id=%s ignored", event_id)
        return jsonify({"status": "duplicate", "id": event_id}), 200

    try:
        handle_event(event)
    except Exception:
        # If processing fails, remove the id so it can be retried.
        with _processed_lock:
            _processed_event_ids.discard(str(event_id))
        app.logger.exception("Error processing event id=%s", event_id)
        abort(500, description="Processing error")

    return jsonify({"status": "processed", "id": event_id}), 200


@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": getattr(e, "description", "Bad Request")}), 400


@app.errorhandler(401)
def unauthorized(e):
    return jsonify({"error": getattr(e, "description", "Unauthorized")}), 401


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": getattr(e, "description", "Internal Server Error")}), 500


if __name__ == "__main__":
    if not WEBHOOK_SECRET:
        raise SystemExit("WEBHOOK_SECRET environment variable must be set")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))