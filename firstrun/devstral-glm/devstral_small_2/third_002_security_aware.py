from flask import Flask, request, jsonify
import hmac
import hashlib
import secrets

app = Flask(__name__)

# Configuration - replace with your actual values
WEBHOOK_SECRET = 'your_webhook_secret_key_here'
EVENT_STORE = {}  # In-memory store for idempotency (replace with DB in production)

def verify_hmac_signature(request_body, signature_header):
    """Verify HMAC-SHA256 signature of the request body."""
    if not signature_header:
        return False

    # Calculate expected signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        request_body,
        hashlib.sha256
    ).hexdigest()

    # Compare with provided signature (constant-time comparison)
    return hmac.compare_digest(expected_signature, signature_header)

@app.route('/webhook', methods=['POST'])
def webhook():
    # Get raw request body
    request_body = request.get_data()

    # Get signature from headers (adjust header name as per your provider)
    signature_header = request.headers.get('X-Webhook-Signature')

    # Verify HMAC signature
    if not verify_hmac_signature(request_body, signature_header):
        return jsonify({'error': 'Invalid or missing signature'}), 401

    try:
        event_data = request.json
        event_id = event_data.get('id')

        if not event_id:
            return jsonify({'error': 'Missing event ID'}), 400

        # Idempotency check - only process each event once
        if EVENT_STORE.get(event_id):
            return jsonify({'message': 'Event already processed', 'event_id': event_id}), 200

        # Process the event (example processing)
        EVENT_STORE[event_id] = True
        # Your actual event processing logic here

        return jsonify({
            'status': 'success',
            'event_id': event_id,
            'message': 'Event processed successfully'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)