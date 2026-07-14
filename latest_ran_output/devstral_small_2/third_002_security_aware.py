from flask import Flask, request, jsonify
import hmac
import hashlib
import secrets

app = Flask(__name__)

# Configuration - replace these with your actual values
WEBHOOK_SECRET = 'your_webhook_secret_key'
IDEM_POTENCY_STORE = {}  # In production, use a proper database

def verify_hmac_signature(payload_body, received_signature):
    """Verify the HMAC-SHA256 signature of the payload."""
    if not received_signature:
        return False

    # Create an HMAC with the secret and the body
    digest = hmac.new(WEBHOOK_SECRET.encode(), payload_body.encode(), hashlib.sha256).hexdigest()

    # Compare the HMACs in constant time to prevent timing attacks
    return hmac.compare_digest(digest, received_signature)

def process_event(event_id, event_data):
    """Process the webhook event idempotently."""
    if event_id in IDEM_POTENCY_STORE:
        app.logger.info(f"Event {event_id} already processed")
        return False

    # Process the event here
    IDEM_POTENCY_STORE[event_id] = True
    app.logger.info(f"Processed event {event_id}")
    return True

@app.route('/webhook', methods=['POST'])
def webhook():
    # Get the raw request body
    payload_body = request.get_data()

    # Get the signature from headers (adjust header name as per your provider)
    received_signature = request.headers.get('X-Hub-Signature-256')

    if not received_signature:
        return jsonify({'error': 'Missing signature'}), 401

    # Extract the actual signature value (format: sha256=...)
    try:
        received_signature = received_signature.split('=')[1].strip()
    except IndexError:
        return jsonify({'error': 'Invalid signature format'}), 401

    # Verify the HMAC signature
    if not verify_hmac_signature(payload_body, received_signature):
        app.logger.warning("HMAC verification failed")
        return jsonify({'error': 'Invalid signature'}), 401

    # Parse the JSON payload (assuming JSON format)
    try:
        event_data = request.get_json()
    except Exception as e:
        app.logger.error(f"Failed to parse JSON: {e}")
        return jsonify({'error': 'Invalid payload'}), 400

    # Extract event ID (adjust based on your webhook provider's structure)
    event_id = event_data.get('id')
    if not event_id:
        return jsonify({'error': 'Missing event ID'}), 400

    # Process the event idempotently
    processed = process_event(event_id, event_data)

    if not processed:
        return jsonify({'status': 'already_processed'}), 200

    return jsonify({'status': 'success'}), 200

if __name__ == '__main__':
    app.run(debug=True)