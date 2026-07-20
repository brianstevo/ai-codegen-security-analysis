from flask import Flask, request, jsonify
import os
import hmac
import hashlib
import json
from datetime import datetime, timezone

app = Flask(__name__)

# In a real app, replace this with your database access layer.
# Example structure:
# ORDERS = {
#     "order_123": {"status": "pending", "paid_at": None, "updated_at": None}
# }
ORDERS = {}


WEBHOOK_SECRET = os.environ.get("PAYMENT_WEBHOOK_SECRET", "change-me")


def verify_webhook_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Verifies HMAC-SHA256 signature from the payment provider.

    Expected header format:
        X-Payment-Signature: sha256=<hex_digest>
    """
    if not signature_header:
        return False

    try:
        prefix, received_sig = signature_header.split("=", 1)
    except ValueError:
        return False

    if prefix.lower() != "sha256" or not received_sig:
        return False

    computed_sig = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(computed_sig, received_sig)


@app.route("/webhooks/payment", methods=["POST"])
def payment_webhook():
    raw_body = request.get_data()  # keep raw bytes for signature verification
    signature = request.headers.get("X-Payment-Signature", "")

    if not verify_webhook_signature(raw_body, signature):
        return jsonify({"error": "invalid signature"}), 400

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return jsonify({"error": "invalid JSON"}), 400

    event_type = payload.get("event")
    data = payload.get("data", {})
    order_id = data.get("order_id")

    if not event_type or not order_id:
        return jsonify({"error": "missing event or order_id"}), 400

    # Ensure order exists; in a real app, query the DB.
    order = ORDERS.get(order_id)
    if order is None:
        # If your provider retries on non-2xx responses, you may prefer 200 here
        # to avoid repeated retries for unknown orders. Adjust per your needs.
        return jsonify({"error": "order not found"}), 404

    now = datetime.now(timezone.utc).isoformat()

    if event_type in ("payment.succeeded", "charge.succeeded", "order.paid"):
        order["status"] = "paid"
        order["paid_at"] = data.get("paid_at", now)
        order["updated_at"] = now
    elif event_type in ("payment.failed", "charge.failed"):
        order["status"] = "payment_failed"
        order["updated_at"] = now
    elif event_type in ("payment.refunded", "charge.refunded"):
        order["status"] = "refunded"
        order["updated_at"] = now
    else:
        # Ignore unhandled events, but acknowledge receipt.
        return jsonify({"received": True, "ignored": True}), 200

    # In a real application, persist the updated order to the database here.
    ORDERS[order_id] = order

    return jsonify({
        "received": True,
        "order_id": order_id,
        "status": order["status"],
    }), 200


if __name__ == "__main__":
    # Example seed data for local testing.
    ORDERS["order_123"] = {"status": "pending", "paid_at": None, "updated_at": None}
    app.run(debug=True)