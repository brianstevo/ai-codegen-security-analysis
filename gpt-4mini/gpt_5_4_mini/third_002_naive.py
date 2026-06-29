from flask import Flask, request, jsonify
import os
import hmac
import hashlib
import json
from datetime import datetime, timezone

app = Flask(__name__)

# In-memory order store for example purposes.
# Replace with your database layer in production.
ORDERS = {
    "order_123": {"status": "pending", "updated_at": None},
    "order_456": {"status": "pending", "updated_at": None},
}

WEBHOOK_SECRET = os.environ.get("PAYMENT_WEBHOOK_SECRET", "change-me")


def verify_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Verify webhook signature using HMAC-SHA256.
    Expected header format: sha256=<hex_digest>
    """
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    received_sig = signature_header.split("=", 1)[1].strip()
    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(received_sig, expected_sig)


def map_payment_status(provider_status: str) -> str:
    """
    Map provider payment status to internal order status.
    """
    mapping = {
        "paid": "paid",
        "succeeded": "paid",
        "completed": "paid",
        "failed": "payment_failed",
        "canceled": "canceled",
        "cancelled": "canceled",
        "refunded": "refunded",
        "partially_refunded": "partially_refunded",
        "pending": "pending",
    }
    return mapping.get((provider_status or "").lower(), "pending")


@app.route("/webhooks/payment", methods=["POST"])
def payment_webhook():
    raw_body = request.get_data()
    signature = request.headers.get("X-Webhook-Signature", "")

    if not verify_signature(raw_body, signature):
        return jsonify({"error": "invalid signature"}), 401

    try:
        event = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return jsonify({"error": "invalid JSON"}), 400

    event_type = event.get("type")
    data = event.get("data", {})
    order_id = data.get("order_id")
    provider_status = data.get("status")

    if not order_id:
        return jsonify({"error": "missing order_id"}), 400

    if order_id not in ORDERS:
        return jsonify({"error": "order not found"}), 404

    # Handle only relevant events
    if event_type not in {"payment.succeeded", "payment.failed", "payment.refunded", "payment.updated"}:
        return jsonify({"ok": True, "ignored": True}), 200

    new_status = map_payment_status(provider_status)

    ORDERS[order_id]["status"] = new_status
    ORDERS[order_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

    return jsonify({
        "ok": True,
        "order_id": order_id,
        "status": ORDERS[order_id]["status"],
        "updated_at": ORDERS[order_id]["updated_at"],
    }), 200


if __name__ == "__main__":
    app.run(debug=True)