```python
import hmac
import hashlib
import json
import logging
from functools import wraps
from flask import Flask, request, jsonify
import threading

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
WEBHOOK_SECRET = "your-webhook-secret-key-here"  # Replace with your actual secret
SIGNATURE_HEADER = "X-Webhook-Signature"          # Header name from your provider
EVENT_ID_HEADER = "X-Webhook-Event-ID"            # Header name for event ID

# Thread-safe in-memory store for processed event IDs (use Redis/DB in production)
processed_events = set()
processed_events_lock = threading.Lock()


def compute_hmac_sha256(secret: str, payload: bytes) -> str:
    """Compute HMAC-SHA256 signature for the given payload."""
    return hmac.new(
        key=secret.encode("utf-8"),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()


def verify_signature(payload: bytes, provided_signature: str) -> bool:
    """
    Verify the HMAC-SHA256 signature of the incoming webhook payload.
    Uses hmac.compare_digest to prevent timing attacks.
    """
    expected_signature = compute_hmac_sha256(WEBHOOK_SECRET, payload)

    # Some providers prefix the signature (e.g., "sha256=<hex>")
    # Strip the prefix if present
    if provided_signature.startswith("sha256="):
        provided_signature = provided_signature[len("sha256="):]

    return hmac.compare_digest(expected_signature, provided_signature)


def require_valid_signature(f):
    """Decorator to enforce HMAC-SHA256 signature validation on webhook endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Read raw request body for signature verification
        raw_body = request.get_data()

        # Check for signature header
        provided_signature = request.headers.get(SIGNATURE_HEADER)
        if not provided_signature:
            logger.warning(
                "Rejected webhook: missing signature header from %s",
                request.remote_addr
            )
            return jsonify({
                "error": "Unauthorized",
                "message": "Missing signature header"
            }), 401

        # Verify the signature
        if not verify_signature(raw_body, provided_signature):
            logger.warning(
                "Rejected webhook: invalid signature from %s",
                request.remote_addr
            )
            return jsonify({
                "error": "Unauthorized",
                "message": "Invalid signature"
            }), 401

        logger.info("Webhook signature verified successfully from %s", request.remote_addr)
        return f(*args, **kwargs)

    return decorated_function


def is_event_processed(event_id: str) -> bool:
    """Check if an event has already been processed (idempotency check)."""
    with processed_events_lock:
        return event_id in processed_events


def mark_event_processed(event_id: str) -> None:
    """Mark an event as processed."""
    with processed_events_lock:
        processed_events.add(event_id)
    logger.info("Marked event %s as processed", event_id)


def process_event(event_id: str, event_type: str, payload: dict) -> dict:
    """
    Process a webhook event based on its type.
    Extend this function to handle different event types.
    """
    logger.info("Processing event: id=%s, type=%s", event_id, event_type)

    result = {"status": "processed", "event_id": event_id, "event_type": event_type}

    if event_type == "payment.completed":
        result["message"] = handle_payment_completed(payload)
    elif event_type == "payment.failed":
        result["message"] = handle_payment_failed(payload)
    elif event_type == "subscription.created":
        result["message"] = handle_subscription_created(payload)
    elif event_type == "subscription.cancelled":
        result["message"] = handle_subscription_cancelled(payload)
    elif event_type == "user.created":
        result["message"] = handle_user_created(payload)
    else:
        logger.info("Unhandled event type: %s", event_type)
        result["message"] = f"Unhandled event type: {event_type}"

    return result


def handle_payment_completed(payload: dict) -> str:
    """Handle payment.completed events."""
    amount = payload.get("amount", "unknown")
    currency = payload.get("currency", "unknown")
    logger.info("Payment completed: %s %s", amount, currency)
    return f"Payment of {amount} {currency} processed"


def handle_payment_failed(payload: dict) -> str:
    """Handle payment.failed events."""
    reason = payload.get("reason", "unknown")
    logger.warning("Payment failed: %s", reason)
    return f"Payment failure recorded: {reason}"


def handle_subscription_created(payload: dict) -> str:
    """Handle subscription.created events."""
    plan = payload.get("plan", "unknown")
    logger.info("Subscription created: plan=%s", plan)
    return f"Subscription created for plan: {plan}"


def handle_subscription_cancelled(payload: dict) -> str:
    """Handle subscription.cancelled events."""
    reason = payload.get("reason", "unknown")
    logger.info("Subscription cancelled: reason=%s", reason)
    return f"Subscription cancellation recorded: {reason}"


def handle_user_created(payload: dict) -> str:
    """Handle user.created events."""
    user_id = payload.get("user_id", "unknown")
    logger.info("User created: user_id=%s", user_id)
    return f"User creation recorded: {user_id}"


@app.route("/webhook", methods=["POST"])
@require_valid_signature
def webhook_receiver():
    """
    Main webhook receiver endpoint.
    Validates signature, ensures idempotency, and processes events.
    """
    # Parse the JSON body
    try:
        payload = request.get_json(force=True)
        if payload is None:
            return jsonify({
                "error": "Bad Request",
                "message": "Invalid JSON payload"
            }), 400
    except Exception as e:
        logger.error("Failed to parse JSON payload: %s", str(e))
        return jsonify({
            "error": "Bad Request",
            "message": "Failed to parse JSON payload"
        }), 400

    # Extract event ID for idempotency
    # Event ID can come from header or payload body
    event_id = request.headers.get(EVENT_ID_HEADER) or payload.get("event_id")
    if not event_id:
        logger.warning("Webhook received without event ID, generating fallback")
        # Fallback: use a hash of the payload as a pseudo-event-ID
        raw_body = request.get_data()
        event_id = hashlib.sha256(raw_body).hexdigest()

    event_type = payload.get("event_type") or payload.get("type", "unknown")

    # Idempotency check: skip if already processed
    if is_event_processed(event_id):
        logger.info("Skipping duplicate event: id=%s, type=%s", event_id, event_type)
        return jsonify({
            "status": "already_processed",
            "event_id": event_id,
            "message": "Event already processed"
        }), 200

    # Process the event
    try:
        result = process_event(event_id, event_type, payload)
        # Mark event as processed only after successful processing
        mark_event_processed(event_id)
        return jsonify(result), 200

    except Exception as e:
        logger.error(
            "Error processing event id=%s type=%s: %s",
            event_id, event_type, str(e)
        )
        return jsonify({
            "error":