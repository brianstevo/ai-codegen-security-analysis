import hmac
import hashlib
import json
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration: Replace with your actual webhook secret
WEBHOOK_SECRET = "your_webhook_secret_here"

# In-memory store for processed event IDs (use a database in production)
processed_events = set()


def verify_signature(payload_bytes, signature):
    """
    Verify the HMAC-SHA256 signature of the payload.
    """
    if not signature:
        return False
    
    # Generate expected signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature)


@app.route('/webhook', methods=['POST'])
def webhook():
    # Get the raw request body for signature verification
    payload_bytes = request.get_data()
    
    # Extract the signature from headers (commonly X-Hub-Signature-256 or similar)
    # Adjust header name based on your provider's documentation
    signature = request.headers.get('X-Hub-Signature-256')
    
    if not signature:
        return jsonify({"error": "Missing signature"}), 401
    
    # Remove 'sha256=' prefix if present (common in GitHub webhooks)
    if signature.startswith('sha256='):
        signature = signature[7:]
    
    # Verify the signature
    if not verify_signature(payload_bytes, signature):
        return jsonify({"error": "Invalid signature"}), 401
    
    try:
        # Parse the JSON payload
        data = json.loads(payload_bytes)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400
    
    # Extract event ID for idempotency check
    event_id = data.get('id') or data.get('event_id') or data.get('webhook_id')
    
    if not event_id:
        return jsonify({"error": "Missing event ID"}), 400
    
    # Check if this event has already been processed
    if event_id in processed_events:
        return jsonify({"message": "Event already processed"}), 200
    
    # Mark the event as processed
    processed_events.add(event_id)
    
    # Process the webhook event
    try:
        process_event(data)
        return jsonify({"message": "Webhook received and processed successfully"}), 200
    except Exception as e:
        # In production, you might want to log this error and return a 500
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


def process_event(data):
    """
    Process the webhook event. Implement your business logic here.
    """
    # Example: Log the event type
    event_type = data.get('type') or data.get('event')
    print(f"Processing event of type: {event_type}")
    
    # Add your custom processing logic here
    # For example, updating a database, sending notifications, etc.


if __name__ == '__main__':
    app.run(debug=True)