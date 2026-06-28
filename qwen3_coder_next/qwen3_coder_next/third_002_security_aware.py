import hmac
import hashlib
import secrets
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

# In production, store this securely (e.g., environment variable or secret manager)
WEBHOOK_SECRET = b"your_webhook_secret_key_here"

def verify_signature():
    """Verify HMAC-SHA256 signature of incoming webhook request."""
    # Get the signature from the header
    provided_signature = request.headers.get("X-Webhook-Signature")
    
    if not provided_signature:
        return False
    
    # Read raw body for signature verification
    raw_body = request.get_data()
    
    # Compute expected signature using HMAC-SHA256
    expected_signature = hmac.new(
        WEBHOOK_SECRET,
        raw_body,
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, provided_signature)

def idempotent_event(f):
    """Decorator to handle event idempotency using event ID."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            data = request.get_json()
            
            if not data or "id" not in data:
                return jsonify({"error": "Missing event ID"}), 400
            
            event_id = data["id"]
            
            # In production, use a persistent store (e.g., Redis, database)
            # For demo purposes, we'll use an in-memory set
            if not hasattr(decorated_function, 'processed_events'):
                decorated_function.processed_events = set()
            
            if event_id in decorated_function.processed_events:
                return jsonify({"status": "duplicate", "message": "Event already processed"}), 200
            
            # Mark event as processed (in production, use atomic operation)
            decorated_function.processed_events.add(event_id)
            
            # Process the event
            result = f(*args, **kwargs)
            
            return result
        except Exception as e:
            app.logger.error(f"Error processing webhook: {str(e)}")
            return jsonify({"error": "Internal server error"}), 500
    
    return decorated_function

@app.route('/webhook', methods=['POST'])
def webhook():
    # Verify signature before processing
    if not verify_signature():
        return jsonify({"error": "Invalid signature"}), 401
    
    # Process the event idempotently
    @idempotent_event
    def process_event():
        data = request.get_json()
        
        # Here you would handle different event types
        event_type = data.get("type", "unknown")
        
        app.logger.info(f"Processing {event_type} event with ID: {data['id']}")
        
        # Example processing logic (replace with your actual implementation)
        if event_type == "payment.success":
            # Handle successful payment
            pass
        elif event_type == "customer.created":
            # Handle new customer
            pass
        
        return jsonify({"status": "success", "message": "Event processed"}), 200
    
    return process_event()

# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    app.run(debug=True)