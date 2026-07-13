```python
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime
from functools import wraps

from flask import Flask, abort, jsonify, request
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

app = Flask(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration
WEBHOOK_SECRET = os.environ.get("PAYMENT_WEBHOOK_SECRET", "your-webhook-secret-here")
ALLOWED_IPS = os.environ.get("ALLOWED_WEBHOOK_IPS", "").split(",")

# Simulated database (replace with actual database in production)
orders_db = {
    "ORD-001": {
        "id": "ORD-001",
        "customer_id": "CUST-123",
        "amount": 9999,
        "currency": "USD",
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "payment_intent_id": None,
        "payment_method": None,
    },
    "ORD-002": {
        "id": "ORD-002",
        "customer_id": "CUST-456",
        "amount": 4999,
        "currency": "USD",
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "payment_intent_id": None,
        "payment_method": None,
    },
}

# Valid order status transitions
VALID_STATUS_TRANSITIONS = {
    "pending": ["processing", "cancelled", "failed"],
    "processing": ["completed", "failed", "refunded"],
    "completed": ["refunded", "partially_refunded"],
    "failed": ["pending"],
    "refunded": [],
    "partially_refunded": ["refunded"],
    "cancelled": [],
}

# Webhook event to order status mapping
EVENT_STATUS_MAP = {
    "payment.initiated": "processing",
    "payment.succeeded": "completed",
    "payment.failed": "failed",
    "payment.cancelled": "cancelled",
    "payment.refunded": "refunded",
    "payment.partially_refunded": "partially_refunded",
    "charge.succeeded": "completed",
    "charge.failed": "failed",
    "charge.refunded": "refunded",
}


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verify the HMAC-SHA256 signature of the webhook payload.
    Supports both raw signature and timestamp-based signatures.
    """
    if not signature or not secret:
        return False

    try:
        # Handle timestamp-based signatures (e.g., "t=timestamp,v1=signature")
        if "," in signature and "=" in signature:
            parts = {
                item.split("=")[0]: item.split("=")[1]
                for item in signature.split(",")
                if "=" in item
            }
            timestamp = parts.get("t", "")
            received_sig = parts.get("v1", "")

            # Prevent replay attacks - reject if timestamp is older than 5 minutes
            if timestamp:
                event_time = int(timestamp)
                current_time = int(datetime.utcnow().timestamp())
                if abs(current_time - event_time) > 300:
                    logger.warning("Webhook timestamp is too old, possible replay attack")
                    return False

            signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
            expected_sig = hmac.new(
                secret.encode("utf-8"),
                signed_payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
        else:
            # Simple HMAC signature
            received_sig = signature
            expected_sig = hmac.new(
                secret.encode("utf-8"),
                payload,
                hashlib.sha256,
            ).hexdigest()

        return hmac.compare_digest(expected_sig, received_sig)

    except Exception as e:
        logger.error(f"Signature verification error: {e}")
        return False


def require_webhook_signature(f):
    """Decorator to verify webhook signature before processing."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get raw payload for signature verification
        raw_payload = request.get_data()

        # Check for signature header (support multiple header names)
        signature = (
            request.headers.get("X-Webhook-Signature")
            or request.headers.get("X-Payment-Signature")
            or request.headers.get("Stripe-Signature")
            or request.headers.get("X-Hub-Signature-256", "").replace("sha256=", "")
        )

        if not signature:
            logger.warning("Webhook received without signature header")
            abort(401, description="Missing webhook signature")

        if not verify_webhook_signature(raw_payload, signature, WEBHOOK_SECRET):
            logger.warning(f"Invalid webhook signature from IP: {request.remote_addr}")
            abort(403, description="Invalid webhook signature")

        return f(*args, **kwargs)

    return decorated_function


def validate_ip_allowlist(f):
    """Decorator to validate the request comes from an allowed IP."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip IP validation if no IPs are configured
        if not ALLOWED_IPS or ALLOWED_IPS == [""]:
            return f(*args, **kwargs)

        client_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        # Take the first IP if multiple are present (proxy chain)
        client_ip = client_ip.split(",")[0].strip()

        if client_ip not in ALLOWED_IPS:
            logger.warning(f"Webhook request from unauthorized IP: {client_ip}")
            abort(403, description="IP not allowed")

        return f(*args, **kwargs)

    return decorated_function


def get_order_by_payment_intent(payment_intent_id: str) -> dict | None:
    """Find an order by payment intent ID."""
    for order in orders_db.values():
        if order.get("payment_intent_id") == payment_intent_id:
            return order
    return None


def update_order_status(order_id: str, new_status: str, metadata: dict = None) -> dict:
    """
    Update order status with validation.
    Returns updated order or raises ValueError on invalid transition.
    """
    if order_id not in orders_db:
        raise ValueError(f"Order {order_id} not found")

    order = orders_db[order_id]
    current_status = order["status"]

    # Validate status transition
    allowed_transitions = VALID_STATUS_TRANSITIONS.get(current_status, [])
    if new_status not in allowed_transitions:
        raise ValueError(
            f"Invalid status transition from '{current_status}' to '{new_status}' "
            f"for order {order_id}"
        )

    # Update order
    order["status"] = new_status
    order["updated_at"] = datetime.utcnow().isoformat()

    # Update additional metadata if provided
    if metadata:
        if "payment_intent_id" in metadata:
            order["payment_intent_id"] = metadata["payment_intent_id"]
        if "payment_method" in metadata:
            order["payment_method"] = metadata["payment_method"]
        if "failure_reason" in metadata:
            order["failure_reason"] = metadata["failure_reason"]
        if "refund_amount" in metadata:
            order["refund_amount"] = metadata["refund_amount"]

    logger.info(
        f"Order {order_id} status updated: {current_status} -> {new_status}"
    )

    return order


def process_payment_event(event