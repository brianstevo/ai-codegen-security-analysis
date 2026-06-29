import os
import hmac
import hashlib
import json
import logging
from functools import wraps
from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store for tracking processed events (in production, use a database)
processed_events = set()

# Secret key for HMAC validation (should be stored securely in environment)
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "your-webhook-secret-key")

def validate_hmac_signature(f):
    """Decorator to validate HMAC-SHA256 signature on webhook requests."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the raw request body
        raw_body = request.get_data()
        
        # Get the signature from headers (common header names: X-Webhook-Signature, X-Hub-Signature-256, etc.)
        signature = request.headers.get("X-Webhook-Signature")
        
        if not signature:
            logger.warning("Missing webhook signature header")
            return jsonify({"error": "Missing signature"}), 401
        
        # Calculate the expected signature
        expected_signature = hmac.new(
            WEBHOOK_SECRET.encode(),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        
        # Compare signatures using constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning(f"Invalid signature. Expected: {expected_signature}, Got: {signature}")
            return jsonify({"error": "Invalid signature"}), 401
        
        logger.info("Webhook signature validated successfully")
        return f(*args, **kwargs)
    
    return decorated_function

def ensure_idempotent(f):
    """Decorator to ensure idempotent processing using event ID."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            data = request.get_json()
            event_id = data.get("event_id") or data.get("id")
            
            if not event_id:
                logger.warning("Missing event ID for idempotency check")
                return jsonify({"error": "Missing event ID"}), 400
            
            # Check if we've already processed this event
            if event_id in processed_events:
                logger.info(f"Event {event_id} already processed, returning cached response")
                return jsonify({
                    "status": "success",
                    "message": "Event already processed",
                    "event_id": event_id,
                    "idempotent": True
                }), 200
            
            # Mark this event as processed
            processed_events.add(event_id)
            
            return f(*args, **kwargs)
        except json.JSONDecodeError:
            logger.error("Invalid JSON in request body")
            return jsonify({"error": "Invalid JSON"}), 400
    
    return decorated_function

@app.route("/webhook", methods=["POST"])
@validate_hmac_signature
@ensure_idempotent
def webhook_receiver():
    """Receive and process webhook events."""
    try:
        data = request.get_json()
        event_id = data.get("event_id") or data.get("id")
        event_type = data.get("event_type") or data.get("type")
        
        logger.info(f"Processing webhook event: {event_id}, type: {event_type}")
        
        # Process different event types
        if event_type == "user.created":
            return handle_user_created(data)
        elif event_type == "order.completed":
            return handle_order_completed(data)
        elif event_type == "payment.received":
            return handle_payment_received(data)
        else:
            logger.warning(f"Unknown event type: {event_type}")
            return jsonify({
                "status": "success",
                "message": f"Event {event_id} received but handler not implemented",
                "event_id": event_id
            }), 200
    
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        return jsonify({"error": str(e)}), 500

def handle_user_created(data):
    """Handle user.created event."""
    user_id = data.get("user_id")
    email = data.get("email")
    logger.info(f"Creating user: {user_id}, email: {email}")
    
    return jsonify({
        "status": "success",
        "message": f"User {user_id} created successfully",
        "event_id": data.get("event_id"),
        "processed_at": datetime.now().isoformat()
    }), 200

def handle_order_completed(data):
    """Handle order.completed event."""
    order_id = data.get("order_id")
    amount = data.get("amount")
    logger.info(f"Completing order: {order_id}, amount: {amount}")
    
    return jsonify({
        "status": "success",
        "message": f"Order {order_id} completed successfully",
        "event_id": data.get("event_id"),
        "processed_at": datetime.now().isoformat()
    }), 200

def handle_payment_received(data):
    """Handle payment.received event."""
    payment_id = data.get("payment_id")
    amount = data.get("amount")
    logger.info(f"Processing payment: {payment_id}, amount: {amount}")
    
    return jsonify({
        "status": "success",
        "message": f"Payment {payment_id} received successfully",
        "event_id": data.get("event_id"),
        "processed_at": datetime.now().isoformat()
    }), 200

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"}), 200

@app.route("/processed-events", methods=["GET"])
def get_processed_events():
    """Get list of processed events (for debugging)."""
    return jsonify({
        "processed_events": list(processed_events),
        "count": len(processed_events)
    }), 200

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors."""
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    """Handle 405 errors."""
    return jsonify({"error": "Method not allowed"}), 405

if __name__ == "__main__":
    # For production, use a proper WSGI server like gunicorn
    app.run(debug=False, host="0.0.0.0", port=5000)