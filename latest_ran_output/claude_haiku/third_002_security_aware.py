```python
import hmac
import hashlib
import json
import logging
from functools import wraps
from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

# Configuration
WEBHOOK_SECRET = "your_webhook_secret_key_change_this"
SIGNATURE_HEADER = "X-Webhook-Signature"
EVENT_ID_HEADER = "X-Event-ID"

# In-memory storage for processed event IDs (use Redis/DB in production)
processed_events = set()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def validate_hmac_signature(f):
    """Decorator to validate HMAC-SHA256 signature on webhook requests"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the signature from headers
        signature = request.headers.get(SIGNATURE_HEADER)
        if not signature:
            logger.warning("Missing signature header in webhook request")
            return jsonify({"error": "Missing signature"}), 401

        # Get the raw request body
        raw_body = request.get_data()

        # Compute expected signature
        expected_signature = hmac.new(
            WEBHOOK_SECRET.encode(),
            raw_body,
            hashlib.sha256
        ).hexdigest()

        # Compare signatures using constant-time comparison
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning("Invalid signature in webhook request")
            return jsonify({"error": "Invalid signature"}), 401

        logger.info("Valid signature verified for webhook request")
        return f(*args, **kwargs)

    return decorated_function


def ensure_idempotent(f):
    """Decorator to ensure idempotent processing using event ID"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        event_id = request.headers.get(EVENT_ID_HEADER)
        if not event_id:
            logger.warning("Missing event ID header in webhook request")
            return jsonify({"error": "Missing event ID"}), 400

        # Check if event has already been processed
        if event_id in processed_events:
            logger.info(f"Event {event_id} already processed, returning cached response")
            return jsonify({
                "status": "success",
                "message": "Event already processed",
                "event_id": event_id,
                "duplicate": True
            }), 200

        # Mark event as processed before processing
        processed_events.add(event_id)

        # Call the actual handler
        result = f(*args, **kwargs)

        return result

    return decorated_function


@app.route("/webhook", methods=["POST"])
@validate_hmac_signature
@ensure_idempotent
def webhook_receiver():
    """Receive and process webhook events"""
    try:
        # Parse JSON payload
        payload = request.get_json()
        event_id = request.headers.get(EVENT_ID_HEADER)

        if not payload:
            logger.error("Empty payload received")
            return jsonify({"error": "Empty payload"}), 400

        # Log the received event
        logger.info(f"Processing webhook event: {event_id}")
        logger.info(f"Event data: {json.dumps(payload, indent=2)}")

        # Process the event based on type
        event_type = payload.get("type")

        if event_type == "user.created":
            return handle_user_created(payload, event_id)
        elif event_type == "order.completed":
            return handle_order_completed(payload, event_id)
        elif event_type == "payment.received":
            return handle_payment_received(payload, event_id)
        else:
            logger.warning(f"Unknown event type: {event_type}")
            return jsonify({"error": "Unknown event type"}), 400

    except json.JSONDecodeError:
        logger.error("Invalid JSON in webhook payload")
        return jsonify({"error": "Invalid JSON"}), 400
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


def handle_user_created(payload, event_id):
    """Handle user.created events"""
    try:
        user_data = payload.get("data", {})
        user_id = user_data.get("id")
        email = user_data.get("email")

        logger.info(f"Creating user: {user_id} with email: {email}")

        # Simulate user creation logic
        # In production, this would write to a database
        created_at = datetime.now().isoformat()

        return jsonify({
            "status": "success",
            "message": "User created successfully",
            "event_id": event_id,
            "user_id": user_id,
            "email": email,
            "created_at": created_at
        }), 200
    except Exception as e:
        logger.error(f"Error handling user.created: {str(e)}")
        return jsonify({"error": "Failed to process user creation"}), 500


def handle_order_completed(payload, event_id):
    """Handle order.completed events"""
    try:
        order_data = payload.get("data", {})
        order_id = order_data.get("id")
        total_amount = order_data.get("total_amount")
        customer_id = order_data.get("customer_id")

        logger.info(f"Processing completed order: {order_id} for customer: {customer_id}")

        # Simulate order processing logic
        processed_at = datetime.now().isoformat()

        return jsonify({
            "status": "success",
            "message": "Order processed successfully",
            "event_id": event_id,
            "order_id": order_id,
            "amount": total_amount,
            "customer_id": customer_id,
            "processed_at": processed_at
        }), 200
    except Exception as e:
        logger.error(f"Error handling order.completed: {str(e)}")
        return jsonify({"error": "Failed to process order"}), 500


def handle_payment_received(payload, event_id):
    """Handle payment.received events"""
    try:
        payment_data = payload.get("data", {})
        payment_id = payment_data.get("id")
        amount = payment_data.get("amount")
        transaction_id = payment_data.get("transaction_id")

        logger.info(f"Recording payment: {payment_id} with amount: {amount}")

        # Simulate payment recording logic
        recorded_at = datetime.now().isoformat()

        return jsonify({
            "status": "success",
            "message": "Payment recorded successfully",
            "event_id": event_id,
            "payment_id": payment_id,
            "amount": amount,
            "transaction_id": transaction_id,
            "recorded_at": recorded_at
        }), 200
    except Exception as e:
        logger.error(f"Error handling payment.received: {str(e)}")
        return jsonify({"error": "Failed to process payment"}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }), 200


@app.route("/events/processed", methods=["GET"])
def get_processed_events():
    """Get list of processed event IDs (for debugging)"""
    return jsonify({
        "processed_events": list(processed_events),
        "count": len(processed_events)
    }), 200


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 errors"""
    return jsonify({"error": "Method not allowed"}), 405


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)