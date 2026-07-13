import hmac
import hashlib
import os
import threading
from flask import Flask, request, abort, jsonify

app = Flask(__name__)

# Shared secret used to verify the provider's HMAC-SHA256 signature.
# Configure this via environment variable in production.
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "").encode("utf-8")

# Header the provider uses to send the signature.
SIGNATURE_HEADER = "X-Webhook-Signature"
# Header the provider uses to send a unique event identifier.
EVENT_ID_HEADER = "X-Webhook-Event-Id"

# In-memory store of processed event IDs for idempotency.
# Replace with a persistent/shared store (e.g. Redis, DB) in production.
_processed_events = set()
_processed_lock = threading.Lock()


def compute_signature(secret: bytes, payload: bytes) -> str:
    """Compute the hex-encoded HMAC-SHA256 signature for the given payload."""
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()


def extract_signature(raw_header: str) -> str:
    """
    Extract the hex digest from the signature header.
    Supports plain hex or a prefixed form like 'sha256=<hex>'.
    """
    if not raw_header:
        return ""
    raw_header = raw_header.strip()
    if "=" in raw_header:
        scheme, _, value = raw_header.partition("=")
        if scheme.lower() in ("sha256", "hmac-sha256"):
            return value.strip()
    return raw_header


def verify_signature(payload: bytes, provided_signature: str) -> bool:
    """Constant-time comparison of the provided signature against the expected one."""
    if not WEBHOOK_SECRET:
        # No secret configured: fail closed.
        return False
    if not provided_signature:
        return False
    expected = compute_signature(WEBHOOK_SECRET, payload)
    return hmac.compare_digest(expected, provided_signature)


def already_processed(event_id: str) -> bool:
    """Return True if the event was already processed; otherwise mark it processed."""
    with _processed_lock:
        if event_id in _processed_events:
            return True
        _processed_events.add(event_id)
        return False


def process_event(event_id: str, payload: bytes):
    """
    Handle the webhook event. Implement your business logic here.
    This function is only called for verified, non-duplicate events.
    """
    app.logger.info("Processing webhook event %s (%d bytes)", event_id, len(payload))
    # ... your event handling logic ...


@app.route("/webhook", methods=["POST"])
def webhook():
    # Read the raw body exactly as received for signature verification.
    raw_body = request.get_data()

    provided_signature = extract_signature(request.headers.get(SIGNATURE_HEADER, ""))

    if not verify_signature(raw_body, provided_signature):
        app.logger.warning("Rejected webhook: missing or invalid signature")
        abort(401, description="Invalid or missing signature")

    event_id = request.headers.get(EVENT_ID_HEADER, "").strip()
    if not event_id:
        abort(400, description="Missing event ID")

    if already_processed(event_id):
        # Idempotent: acknowledge without reprocessing.
        return jsonify({"status": "duplicate", "event_id": event_id}), 200

    try:
        process_event(event_id, raw_body)
    except Exception:
        # If processing fails, allow retries by un-marking the event.
        with _processed_lock:
            _processed_events.discard(event_id)
        app.logger.exception("Error processing webhook event %s", event_id)
        abort(500, description="Error processing event")

    return jsonify({"status": "processed", "event_id": event_id}), 200


@app.errorhandler(400)
def handle_400(err):
    return jsonify({"error": "bad_request", "message": err.description}), 400


@app.errorhandler(401)
def handle_401(err):
    return jsonify({"error": "unauthorized", "message": err.description}), 401


@app.errorhandler(500)
def handle_500(err):
    return jsonify({"error": "internal_error", "message": getattr(err, "description", "internal error")}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))