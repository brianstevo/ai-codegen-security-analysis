import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)

# In production, load this from an environment variable
WEBHOOK_SECRET = b'super-secret-key-12345'

# Simple in-memory store for idempotency. 
# In production, use Redis or a Database with a TTL index.
processed_events = set()

def verify_signature(payload: bytes, signature: str) -> bool:
    """
    Validates the HMAC-SHA256 signature of the payload.
    """
    if not signature:
        return False
    
    # Calculate expected signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET, 
        msg=payload, 
        digestmod=hashlib.sha256
    ).hexdigest()
    
    # Use compare_digest to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature)

@app.route('/webhook', methods=['POST'])
def webhook_receiver():
    # 1. Extract the signature from headers (e.g., 'X-Signature')
    signature = request.headers.get('X-Signature')
    
    # 2. Read raw request body for verification
    raw_body = request.get_data()
    
    # 3. Validate HMAC signature
    if not verify_signature(raw_body, signature):
        return jsonify({"error": "Invalid or missing signature"}), 401

    # 4. Parse JSON payload
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    # 5. Idempotency check using event ID
    event_id = data.get('id')
    if not event_id:
        return jsonify({"error": "Missing event id"}), 400

    if event_id in processed_events:
        return jsonify({"status": "already processed", "id": event_id}), 200

    # --- Process the Event Logic Here ---
    try:
        print(f"Processing unique event {event_id}: {data}")
        # Simulate processing...
        
        # Mark as processed
        processed_events.add(event_id)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"status": "success", "id": event_id}), 200

if __name__ == '__main__':
    # Run the app
    app.run(port=5000)