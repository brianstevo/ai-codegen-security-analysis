```python
import os
import hmac
import hashlib
import json
import logging
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, abort
import jwt
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration — load from environment variables in production
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "your-webhook-secret-key")
API_SECRET_KEY = os.environ.get("API_SECRET_KEY", "your-api-secret-key")
SIGNATURE_HEADER = "X-Payment-Signature"
TIMESTAMP_HEADER = "X-Payment-Timestamp"
TOLERANCE_SECONDS = 300  # 5-minute replay-attack window

# ---------------------------------------------------------------------------
# Simulated in-memory order store (replace with your real DB layer)
# ---------------------------------------------------------------------------
ORDERS: dict[str, dict] = {
    "ORD-001": {"id": "ORD-001", "status": "pending", "amount": 9999, "currency": "USD"},
    "ORD-002": {"id": "ORD-002", "status": "pending", "amount": 4999, "currency": "USD"},
}

# ---------------------------------------------------------------------------
# Valid order status transitions
# ---------------------------------------------------------------------------
VALID_TRANSITIONS: dict[str, list[str]] = {
    "pending":    ["paid", "failed", "cancelled"],
    "paid":       ["refunded", "partially_refunded", "disputed"],
    "failed":     ["pending"],           # allow retry
    "cancelled":  [],
    "refunded":   [],
    "partially_refunded": ["refunded"],
    "disputed":   ["paid", "refunded"],
}

# ---------------------------------------------------------------------------
# Mapping from payment-provider event types to internal order statuses
# ---------------------------------------------------------------------------
EVENT_STATUS_MAP: dict[str, str] = {
    "payment.succeeded":          "paid",
    "payment.failed":             "failed",
    "payment.cancelled":          "cancelled",
    "payment.refunded":           "refunded",
    "payment.partially_refunded": "partially_refunded",
    "payment.dispute.created":    "disputed",
    "payment.dispute.resolved":   "paid",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def verify_webhook_signature(payload: bytes, signature: str, timestamp: str) -> bool:
    """
    Verify HMAC-SHA256 signature sent by the payment provider.

    Expected signature format:  sha256=<hex-digest>
    Signed string:              <timestamp>.<raw-body>
    """
    if not signature or not timestamp:
        logger.warning("Missing signature or timestamp header.")
        return False

    # Reject stale requests (replay-attack protection)
    try:
        request_time = int(timestamp)
        current_time = int(datetime.utcnow().timestamp())
        if abs(current_time - request_time) > TOLERANCE_SECONDS:
            logger.warning("Webhook timestamp outside tolerance window.")
            return False
    except ValueError:
        logger.warning("Invalid timestamp header value.")
        return False

    # Reconstruct the expected signature
    signed_payload = f"{timestamp}.".encode() + payload
    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode(),
        signed_payload,
        hashlib.sha256
    ).hexdigest()

    # Strip optional "sha256=" prefix supplied by some providers
    received_sig = signature.removeprefix("sha256=")

    return hmac.compare_digest(expected_sig, received_sig)


def require_webhook_auth(f):
    """Decorator that enforces webhook signature verification."""
    @wraps(f)
    def decorated(*args, **kwargs):
        raw_body = request.get_data()  # must read before parsing JSON
        signature = request.headers.get(SIGNATURE_HEADER, "")
        timestamp = request.headers.get(TIMESTAMP_HEADER, "")

        if not verify_webhook_signature(raw_body, signature, timestamp):
            logger.error("Webhook signature verification failed.")
            abort(401, description="Invalid or missing webhook signature.")

        return f(*args, **kwargs)
    return decorated


def get_order(order_id: str) -> dict | None:
    """Fetch an order by ID (replace with real DB call)."""
    return ORDERS.get(order_id)


def update_order_status(order_id: str, new_status: str) -> dict:
    """
    Persist the new order status (replace with real DB write).
    Returns the updated order record.
    """
    ORDERS[order_id]["status"] = new_status
    ORDERS[order_id]["updated_at"] = datetime.utcnow().isoformat()
    logger.info("Order %s updated to status '%s'.", order_id, new_status)
    return ORDERS[order_id]


def is_valid_transition(current_status: str, new_status: str) -> bool:
    """Check whether a status transition is permitted."""
    return new_status in VALID_TRANSITIONS.get(current_status, [])


# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------

@app.route("/webhooks/payment", methods=["POST"])
@require_webhook_auth
def payment_webhook():
    """
    Receive and process payment-provider webhook events.

    Expected JSON body:
    {
        "event_type": "payment.succeeded",
        "event_id":   "evt_abc123",
        "created_at": 1700000000,
        "data": {
            "order_id":        "ORD-001",
            "payment_id":      "pay_xyz789",
            "amount":          9999,
            "currency":        "USD",
            "failure_reason":  null   // optional
        }
    }
    """
    # Parse JSON safely
    try:
        payload = request.get_json(force=True, silent=False)
        if payload is None:
            raise ValueError("Empty or non-JSON body.")
    except Exception as exc:
        logger.error("Failed to parse webhook payload: %s", exc)
        return jsonify({"error": "Invalid JSON payload."}), 400

    # Validate required top-level fields
    event_type = payload.get("event_type")
    event_id   = payload.get("event_id")
    data       = payload.get("data", {})

    if not event_type or not event_id or not isinstance(data, dict):
        logger.warning("Malformed webhook payload: %s", payload)
        return jsonify({"error": "Missing required fields: event_type, event_id, data."}), 400

    # Validate required data fields
    order_id   = data.get("order_id")
    payment_id = data.get("payment_id")

    if not order_id or not payment_id:
        logger.warning("Webhook data missing order_id or payment_id.")
        return jsonify({"error": "Missing required data fields: order_id, payment_id."}), 400

    logger.info(
        "Received event '%s' (id=%s) for order '%s', payment '%s'.",
        event_type, event_id, order_id, payment_id
    )

    # Resolve target status from event type
    new_status = EVENT_STATUS_MAP.get(event_type)
    if new_status is None:
        logger.info("Unhandled event type '%s' — acknowledged without action.", event_type)
        return jsonify({"received": True, "message": f"Event type '{event_type}' not handled."}), 200

    # Retrieve the order
    order = get_order(order_id)
    if order is None:
        logger.error("Order '%s' not found.", order_id)
        return jsonify({"error": f"Order '{order_id}' not found."}), 404

    current_status = order["status"]

    # Idempotency guard — already in target status
    if current_status == new_status:
        logger