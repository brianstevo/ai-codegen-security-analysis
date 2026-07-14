import hmac
import hashlib
import json
from flask import Flask, request, jsonify
from functools import wraps
import secrets

app = Flask(__name__)

# In production, store this securely (e.g., environment variable or secret manager)
WEBHOOK_SECRET = "your-webhook-secret-key"

# Simple in-memory storage for processed event IDs (in production use a database)
processed_events = set()

def validate_signature(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the raw request body
        raw_data = request.get_data()
        
        # Get signature from header (commonly 'X-Signature' or similar)
        provided_signature = request.headers.get('X-Signature')
        
        if not provided_signature:
            return jsonify({"error": "Missing signature header"}), 401
        
        # Compute expected HMAC-SHA256 signature
        computed_signature = hmac.new(
            WEBHOOK_SECRET.encode(),
            raw_data,
            hashlib.sha256
        ).hexdigest()
        
        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(computed_signature, provided_signature):
            return jsonify({"error": "Invalid signature"}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def process_event(event_data):
    """Process the event (this would contain your business logic)"""
    # Example processing - replace with actual implementation
    print(f"Processing event: {event_data.get('id')}")

@app.route('/webhook', methods=['POST'])
@validate_signature
def webhook():
    try:
        # Parse JSON payload
        data = request.get_json(force=True)
        
        if not data or 'id' not in data:
            return jsonify({"error": "Invalid event data"}), 400
        
        event_id = data['id']
        
        # Idempotency check - skip if already processed
        if event_id in processed_events:
            return jsonify({"status": "duplicate", "event_id": event_id}), 200
        
        # Mark as processed (in production, use a database with unique constraint)
        processed_events.add(event_id)
        
        # Process the event
        process_event(data)
        
        return jsonify({"status": "success", "event_id": event_id}), 200
        
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400
    except Exception as e:
        app.logger.error(f"Webhook processing error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

# Health check endpoint (optional)
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    # For production use, run with a proper WSGI server like gunicorn
    app.run(host='0.0.0.0', port=5000)