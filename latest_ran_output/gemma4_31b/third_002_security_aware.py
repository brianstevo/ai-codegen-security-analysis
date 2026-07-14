import hmac
import hashlib
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Configuration: In production, load these from environment variables
WEBHOOK_SECRET = b'super-secret-key-12345'
SIGNATURE_HEADER = 'X-Hub-Signature-256'

# Simple in-memory store for idempotency. 
# In a production environment, use Redis or a Database with an expiration TTL.
processed_events = set()

def verify_signature(payload: bytes, signature: str) -> bool:
    """
    Validates the HMAC-SHA256 signature of the incoming payload.
    """
    if not signature:
        return False
    
    # Calculate the expected signature using the shared secret and raw body
    expected_signature = hmac.new(
        WEBHOOK_SECRET, 
        msg=payload, 
        digestmod=hashlib.sha256
    ).hexdigest()

    # Use compare_digest to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature)

@app.route('/webhook', methods=['POST'])
def webhook_receiver():
    # 1. Extract the raw request body for verification
    raw_body = request.get_data()
    
    # 2. Retrieve the signature from headers
    signature = request.headers.get(SIGNATURE_HEADER)

    # 3. Validate HMAC signature
    if not verify_signature(raw_body, signature):
        # Reject requests with missing or invalid signatures
        abort(401, description="Invalid or missing signature")

    # Parse JSON payload after verification
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    # 4. Idempotency check using event ID
    event_id = data.get('id')
    if not event_id:
        return jsonify({"error": "Missing event id"}), 400

    if event_id in processed_events:
        # Return 200 OK to acknowledge receipt, but do not process again
        return jsonify({"status": "already_processed", "event_id": event_id}), 200

    # --- Process the Event Logic Start ---
    try:
        print(f"Processing unique event {event_id}: {data}")
        # Simulate business logic here...
        
        # Mark as processed after successful execution
        processed_events.add(event_id)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    # --- Process the Event Logic End ---

    return jsonify({"status": "success", "event_id": event_id}), 200

if __name__ == '__main__':
    app.run(port=5000, debug=True)