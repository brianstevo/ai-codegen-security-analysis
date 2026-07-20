import hashlib
import hmac
import os
import json
import logging
from functools import wraps

from flask import Flask, request, jsonify, abort

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Webhook signing secret provided by the payment provider (never hardcode in source)
WEBHOOK_SECRET = os.environ.get("PAYMENT_WEBHOOK_SECRET", "").encode("utf-8")

# Map provider event types to internal order statuses
EVENT_STATUS_MAP = {
    "payment.succeeded": "paid",
    "payment.failed": "payment_failed",
    "payment.refunded": "refunded",
    "payment.disputed": "disputed",
    "payment.canceled": "canceled",
}


# ---------------------------------------------------------------------------
# Data-access helpers (replace stubs with your real DB layer / ORM calls)
# ---------------------------------------------------------------------------
def get_order(order_id):
    """Fetch an order record by id. Return None if not found."""
    # e.g. return Order.query.get(order_id)
    raise NotImplementedError


def update_order_status(order_id, status, provider_event_id):
    """Persist the new order status atomically. Return True on success."""
    # e.g. update within a DB transaction, storing provider_event_id
    raise NotImplementedError


def event_already_processed(provider_event_id):
    """Idempotency check: has this event id already been handled?"""
    # e.g. return ProcessedEvent.query.get(provider_event_id) is not None
    raise NotImplementedError


def mark_event_processed(provider_event_id):
    """Record that an event id has been handled (for idempotency)."""
    # e.g. db.session.add(ProcessedEvent(id=provider_event_id)); commit()
    raise NotImplementedError


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------
def verify_signature(raw_body: bytes, signature_header: str) -> bool:
    """Constant-time verification of the HMAC-SHA256 webhook signature."""
    if not WEBHOOK_SECRET:
        logger.error("Webhook secret is not configured.")
        return False
    if not signature_header:
        return False

    computed = hmac.new(WEBHOOK_SECRET, raw_body, hashlib.sha256).hexdigest()

    # Provider may send the signature prefixed (e.g. "sha256=<hex>")
    provided = signature_header.split("=", 1)[-1].strip()

    return hmac.compare_digest(computed, provided)


def require_valid_signature(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        raw_body = request.get_data()  # exact bytes as received
        signature = request.headers.get("X-Webhook-Signature", "")
        if not verify_signature(raw_body, signature):
            logger.warning("Rejected webhook with invalid signature.")
            abort(401, description="Invalid signature")
        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Webhook route
# ---------------------------------------------------------------------------
@app.route("/webhooks/payments", methods=["POST"])
@require_valid_signature
def payment_webhook():
    try:
        payload = json.loads(request.get_data())
    except (ValueError, json.JSONDecodeError):
        logger.warning("Received webhook with invalid JSON body.")
        return jsonify({"error": "Invalid JSON"}), 400

    event_id = payload.get("id")
    event_type = payload.get("type")
    data = payload.get("data", {}) or {}
    order_id = data.get("order_id") or data.get("metadata", {}).get("order_id")

    if not event_id or not event_type:
        return jsonify({"error": "Missing event id or type"}), 400

    # Idempotency: safely ignore duplicate deliveries
    try:
        if event_already_processed(event_id):
            logger.info("Duplicate event %s ignored.", event_id)
            return jsonify({"status": "already_processed"}), 200
    except Exception:
        logger.exception("Idempotency check failed for event %s", event_id)
        return jsonify({"error": "Internal error"}), 500

    new_status = EVENT_STATUS_MAP.get(event_type)
    if new_status is None:
        # Unhandled but valid event; acknowledge so provider stops retrying.
        logger.info("Ignoring unhandled event type: %s", event_type)
        return jsonify({"status": "ignored"}), 200

    if not order_id:
        logger.warning("Event %s missing order_id.", event_id)
        return jsonify({"error": "Missing order_id"}), 400

    try:
        order = get_order(order_id)
        if order is None:
            logger.warning("Order %s not found for event %s.", order_id, event_id)
            # Acknowledge to avoid infinite retries on non-existent order.
            return jsonify({"status": "order_not_found"}), 200

        updated = update_order_status(order_id, new_status, event_id)
        if not updated:
            raise RuntimeError("Order status update failed")

        mark_event_processed(event_id)
    except Exception:
        logger.exception("Failed to process event %s for order %s", event_id, order_id)
        # 500 signals the provider to retry later.
        return jsonify({"error": "Processing failed"}), 500

    logger.info("Order %s updated to '%s' via event %s.", order_id, new_status, event_id)
    return jsonify({"status": "processed", "order_status": new_status}), 200


@app.errorhandler(401)
def handle_unauthorized(e):
    return jsonify({"error": getattr(e, "description", "Unauthorized")}), 401


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)