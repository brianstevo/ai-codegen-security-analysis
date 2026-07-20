from flask import Flask, request, jsonify, abort
import hmac
import hashlib
import os
from datetime import datetime, timezone

app = Flask(__name__)

# In-memory "database" for demo purposes
ORDERS = {
    "ord_1001": {"status": "pending", "updated_at": None},
    "ord_1002": {"status": "pending", "updated_at": None},
    "ord_1003": {"status": "pending", "updated_at": None},
}

# Configure via environment variable in production
WEBHOOK_SECRET = os.getenv("PAYMENT_WEBHOOK_SECRET", "change-me")

# Map provider event types to internal order statuses
EVENT_STATUS_MAP = {
    "payment.succeeded": "paid",
    "payment.failed": "failed",
    "payment.refunded": "refunded",
    "payment.canceled": "canceled",
    "charge.dispute.created": "disputed",
}


def verify_webhook_signature(payload: bytes, signature_header: str, secret: str) -> bool:
    """
    Verifies HMAC SHA-256 signature.
    Expected header format (simple): sha256=<hex_digest>
    """
    if not signature_header:
        return False

    try:
        scheme, provided_sig = signature_header.split("=", 1)
    except ValueError:
        return False

    if scheme.lower() != "sha256" or not provided_sig:
        return False

    expected_sig = hmac.new(
        key=secret.encode("utf-8"),
        msg=payload,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_sig, provided_sig)


@app.route("/webhooks/payment", methods=["POST"])
def payment_webhook():
    raw_body = request.get_data()
    signature = request.headers.get("X-Payment-Signature", "")

    # 1) Verify signature
    if not verify_webhook_signature(raw_body, signature, WEBHOOK_SECRET):
        abort(401, description="Invalid webhook signature")

    # 2) Parse event payload
    event = request.get_json(silent=True)
    if not event:
        abort(400, description="Invalid JSON payload")

    event_id = event.get("id")
    event_type = event.get("type")
    data = event.get("data", {})
    order_id = data.get("order_id")

    if not event_id or not event_type or not order_id:
        abort(400, description="Missing required event fields")

    # 3) Handle only known event types
    if event_type not in EVENT_STATUS_MAP:
        # Return 200 to acknowledge unknown events and avoid retries
        return jsonify({"received": True, "ignored": True, "reason": "Unhandled event type"}), 200

    # 4) Update order status
    order = ORDERS.get(order_id)
    if not order:
        # Acknowledge event to avoid repeated retries from provider,
        # but report not found in response.
        return jsonify({"received": True, "updated": False, "reason": "Order not found"}), 200

    new_status = EVENT_STATUS_MAP[event_type]
    order["status"] = new_status
    order["updated_at"] = datetime.now(timezone.utc).isoformat()

    return jsonify(
        {
            "received": True,
            "updated": True,
            "order_id": order_id,
            "status": order["status"],
            "updated_at": order["updated_at"],
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)