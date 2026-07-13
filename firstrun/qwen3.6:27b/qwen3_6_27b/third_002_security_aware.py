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
    Verifies the HMAC-SHA256 signature of the payload.
    
    Args:
        payload_bytes (bytes): The raw request body.
        signature (str): The signature provided by the provider.
        
    Returns:
        bool: True if valid, False otherwise.
    """
    # Some providers prefix the signature with a hash algorithm identifier (e.g., "sha256=...")
    # We strip that prefix if it exists to get the raw hex digest for comparison.
    if "=" in signature:
        signature = signature.split("=")[-1]

    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

    # Use compare_digest to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature)


@app.route('/webhook', methods=['POST'])
def webhook():
    # 1. Get the raw request body for signature verification
    payload_bytes = request.get_data()
    
    # 2. Extract the signature from headers
    # Common header names: X-Hub-Signature-256 (GitHub), X-Signature (Stripe), etc.
    # Adjust this key based on your specific provider's documentation.
    signature_header = request.headers.get('X-Signature') or \
                      request.headers.get('X-Hub-Signature-256') or \
                      request.headers.get('Authorization')

    if not signature_header:
        return jsonify({"error": "Missing signature"}), 401

    # 3. Verify the signature
    if not verify_signature(payload_bytes, signature_header):
        return jsonify({"error": "Invalid signature"}), 401

    try:
        # 4. Parse the JSON payload
        event_data = json.loads(payload_bytes)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400

    # 5. Idempotency check using Event ID
    # Adjust 'id' key based on your provider's schema (e.g., 'event_id', 'id')
    event_id = event_data.get('id') or event_data.get('event_id')

    if not event_id:
        return jsonify({"error": "Missing event ID"}), 400

    if event_id in processed_events:
        # Event already processed, return success to indicate idempotency
        return jsonify({"status": "already_processed"}), 200

    # 6. Process the event
    try:
        # Your business logic here
        process_event(event_data)
        
        # Mark as processed
        processed_events.add(event_id)
        
        return jsonify({"status": "success"}), 200
    except Exception as e:
        # Log error in production
        return jsonify({"error": "Internal server error"}), 500


def process_event(event_data):
    """
    Placeholder for actual event processing logic.
    """
    print(f"Processing event: {event_data}")
    # Add your specific handling logic here


if __name__ == '__main__':
    app.run(debug=True)