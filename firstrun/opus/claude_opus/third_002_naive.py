import hmac
import hashlib
import json
import logging
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load from secure config / environment in production
WEBHOOK_SECRET = b"your-payment-provider-webhook-secret"

# Map provider event types to internal order statuses
EVENT_STATUS_MAP = {
    "payment.succeeded": "paid",
    "payment.failed": "failed",
    "payment.refunded": "refunded",
    "payment.pending": "pending",
    "charge.dispute.created": "disputed",
}

# Track processed event IDs to ensure idempotency.
# Replace with a persistent store (DB/Redis) in production.
_processed_events = set()


def verify_signature(payload: bytes, signature: str) -> bool:
    """Verify the HMAC-SHA256 signature from the payment provider."""
    if not signature:
        return False
    expected = hmac.new(WEBHOOK_SECRET, payload, hashlib.sha256).hexdigest()
    # Constant-time comparison to mitigate timing attacks
    return hmac.compare_digest(expected, signature)


def update_order_status(order_id: str, status: str) -> bool:
    """
    Update the order status in your data store.
    Replace this stub with real persistence logic (e.g., SQLAlchemy).
    Returns True if the order existed and was updated.
    """
    # Example placeholder:
    # order = Order.query.get(order_id)
    # if not order:
    #     return False
    # order.status = status
    # db.session.commit()
    logger.info("Order %s updated to status '%s'", order_id, status)
    return True


@app.route("/webhooks/payment", methods=["POST"])
def payment_webhook():
    raw_payload = request.get_data()
    signature = request.headers.get("X-Signature", "")

    # 1. Verify authenticity of the webhook
    if not verify_signature(raw_payload, signature):
        logger.warning("Invalid webhook signature")
        abort(401, description="Invalid signature")

    # 2. Parse JSON safely
    try:
        event = json.loads(raw_payload.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        logger.warning("Malformed JSON payload")
        abort(400, description="Invalid JSON")

    event_id = event.get("id")
    event_type = event.get("type")
    data = event.get("data", {})
    order_id = data.get("order_id")

    if not event_id or not event_type:
        abort(400, description="Missing event id or type")

    # 3. Idempotency check
    if event_id in _processed_events:
        logger.info("Duplicate event %s ignored", event_id)
        return jsonify({"status": "duplicate", "event_id": event_id}), 200

    # 4. Map event to internal status
    new_status = EVENT_STATUS_MAP.get(event_type)
    if new_status is None:
        # Acknowledge unhandled events so provider stops retrying
        logger.info("Unhandled event type: %s", event_type)
        _processed_events.add(event_id)
        return jsonify({"status": "ignored", "event_type": event_type}), 200

    if not order_id:
        abort(400, description="Missing order_id in event data")

    # 5. Update order
    updated = update_order_status(order_id, new_status)
    if not updated:
        logger.error("Order %s not found for event %s", order_id, event_id)
        abort(404, description="Order not found")

    # 6. Mark event as processed
    _processed_events.add(event_id)

    return jsonify({
        "status": "processed",
        "event_id": event_id,
        "order_id": order_id,
        "order_status": new_status,
    }), 200


@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(404)
def handle_error(err):
    return jsonify({"error": getattr(err, "description", str(err))}), err.code


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)