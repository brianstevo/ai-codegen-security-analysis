```python
import hmac
import hashlib
import json
import logging
from functools import wraps
from flask import Flask, request, jsonify
import os
import threading
from datetime import datetime, timezone

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Secret key for HMAC verification - should be set via environment variable
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "your-webhook-secret-key")

# Thread-safe set to track processed event IDs for idempotency
processed_events = set()
processed_events_lock = threading.Lock()

# Storage for processed event metadata (in production, use a database)
event_store = {}
event_store_lock = threading.Lock()


def verify_hmac_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    """
    Verify the HMAC-SHA256 signature of the request body.
    Supports signatures in formats:
      - sha256=<hex_digest>
      - <hex_digest>
    """
    if not signature_header:
        logger.warning("Missing signature header")
        return False

    try:
        # Handle 'sha256=<hex_digest>' format
        if signature_header.startswith("sha256="):
            provided_signature = signature_header[len("sha256="):]
        else:
            provided_signature = signature_header

        # Compute expected HMAC-SHA256
        expected_mac = hmac.new(
            key=secret.encode("utf-8"),
            msg=raw_body,
            digestmod=hashlib.sha256,
        ).hexdigest()

        # Use constant-time comparison to prevent timing attacks
        return hmac.compare_digest(expected_mac, provided_signature)

    except Exception as e:
        logger.error(f"Signature verification error: {e}")
        return False


def require_valid_signature(f):
    """Decorator to enforce HMAC signature validation on routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Read raw request body before any parsing
        raw_body = request.get_data()

        # Extract signature from headers
        # Common header names used by various providers
        signature_header = (
            request.headers.get("X-Hub-Signature-256")
            or request.headers.get("X-Webhook-Signature")
            or request.headers.get("X-Signature-256")
            or request.headers.get("X-Signature")
        )

        if not signature_header:
            logger.warning(
                f"Request rejected: missing signature header. "
                f"Remote addr: {request.remote_addr}"
            )
            return jsonify({
                "error": "Unauthorized",
                "message": "Missing signature header"
            }), 401

        if not verify_hmac_signature(raw_body, signature_header, WEBHOOK_SECRET):
            logger.warning(
                f"Request rejected: invalid signature. "
                f"Remote addr: {request.remote_addr}, "
                f"Signature: {signature_header[:20]}..."
            )
            return jsonify({
                "error": "Unauthorized",
                "message": "Invalid signature"
            }), 401

        logger.info("Signature verified successfully")
        return f(*args, **kwargs)

    return decorated_function


def is_duplicate_event(event_id: str) -> bool:
    """Check if an event has already been processed (thread-safe)."""
    with processed_events_lock:
        return event_id in processed_events


def mark_event_processed(event_id: str, event_data: dict) -> None:
    """Mark an event as processed and store its metadata (thread-safe)."""
    with processed_events_lock:
        processed_events.add(event_id)

    with event_store_lock:
        event_store[event_id] = {
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "event_type": event_data.get("type", "unknown"),
            "event_id": event_id,
        }


def extract_event_id(payload: dict) -> str | None:
    """
    Extract the event ID from the payload.
    Checks common field names used by different providers.
    """
    return (
        payload.get("id")
        or payload.get("event_id")
        or payload.get("webhook_id")
        or payload.get("delivery_id")
        or payload.get("uuid")
    )


def process_event(event_type: str, payload: dict) -> dict:
    """
    Process the webhook event based on its type.
    Add your business logic here for each event type.
    """
    logger.info(f"Processing event type: {event_type}")

    result = {
        "status": "processed",
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Route to appropriate handler based on event type
    handlers = {
        "payment.completed": handle_payment_completed,
        "payment.failed": handle_payment_failed,
        "user.created": handle_user_created,
        "user.updated": handle_user_updated,
        "subscription.created": handle_subscription_created,
        "subscription.cancelled": handle_subscription_cancelled,
    }

    handler = handlers.get(event_type)
    if handler:
        handler_result = handler(payload)
        result.update(handler_result)
    else:
        logger.info(f"No specific handler for event type: {event_type}. Using default.")
        result["message"] = f"Event '{event_type}' received and acknowledged"

    return result


def handle_payment_completed(payload: dict) -> dict:
    """Handle payment.completed events."""
    amount = payload.get("data", {}).get("amount", 0)
    currency = payload.get("data", {}).get("currency", "USD")
    logger.info(f"Payment completed: {amount} {currency}")
    return {"message": f"Payment of {amount} {currency} processed successfully"}


def handle_payment_failed(payload: dict) -> dict:
    """Handle payment.failed events."""
    reason = payload.get("data", {}).get("failure_reason", "Unknown")
    logger.warning(f"Payment failed: {reason}")
    return {"message": f"Payment failure recorded: {reason}"}


def handle_user_created(payload: dict) -> dict:
    """Handle user.created events."""
    user_id = payload.get("data", {}).get("user_id", "unknown")
    logger.info(f"New user created: {user_id}")
    return {"message": f"User {user_id} creation processed"}


def handle_user_updated(payload: dict) -> dict:
    """Handle user.updated events."""
    user_id = payload.get("data", {}).get("user_id", "unknown")
    logger.info(f"User updated: {user_id}")
    return {"message": f"User {user_id} update processed"}


def handle_subscription_created(payload: dict) -> dict:
    """Handle subscription.created events."""
    subscription_id = payload.get("data", {}).get("subscription_id", "unknown")
    logger.info(f"New subscription: {subscription_id}")
    return {"message": f"Subscription {subscription_id} creation processed"}


def handle_subscription_cancelled(payload: dict) -> dict:
    """Handle subscription.cancelled events."""
    subscription_id = payload.get("data", {}).get("subscription_id", "unknown")
    logger.info(f"Subscription cancelled: {subscription_id}")
    return {"message": f"Subscription {subscription_id} cancellation processed"}


@app.route("/webhook", methods=["POST"])
@require_valid_signature
def webhook_receiver():
    """
    Main webhook endpoint.
    Validates HMAC signature and processes events idempotently.
    """
    # Parse JSON payload
    try:
        payload = request.get_json(force=True, silent=True)
        if payload is None:
            return jsonify({
                "error": "Bad Request",
                "message": "Invalid or missing JSON payload"
            }), 400
    except Exception as e:
        logger.error(