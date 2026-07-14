import hmac
import hashlib
import secrets
from flask import Flask, request, jsonify

app = Flask(__name__)

# In a production environment, load this from an environment variable
# e.g., os.environ.get('WEBHOOK_SECRET')
WEBHOOK_SECRET = secrets.token_hex(32)

# In-memory storage for processed event IDs.
# In production, use a database or Redis to persist this.
processed_events = set()

def verify_signature(payload: bytes, signature_header: str) -> bool:
    """
    Verifies the HMAC-SHA256 signature of the payload.
    """
    if not signature_header:
        return False

    # Expected header format: sha256=<hex_digest>
    prefix = 'sha256='
    if not signature_header.startswith(prefix):
        return False

    digest = signature_header[len(prefix):]
    expected_digest = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()

    # Use compare_digest to prevent timing attacks
    return hmac.compare_digest(digest, expected_digest)

@app.route('/webhook', methods=['POST'])
def webhook():
    # 1. Read the raw request body
    payload = request.get_data()

    # 2. Extract the signature header (commonly X-Hub-Signature-256)
    signature = request.headers.get('X-Hub-Signature-256')

    # 3. Validate signature
    if not verify_signature(payload, signature):
        return jsonify({'error': 'Invalid signature'}), 401

    # 4. Process events idempotently using the event ID
    try:
        json_data = request.get_json()
        if not json_data:
            return jsonify({'error': 'Invalid JSON'}), 400

        event_id = json_data.get('event_id')
        if not event_id:
            return jsonify({'error': 'Missing event_id'}), 400

        # Check if event has already been processed
        if event_id in processed_events:
            return jsonify({'status': 'already_processed', 'event_id': event_id}), 200

        # --- BUSINESS LOGIC START ---
        # Here you would process the actual webhook event
        print(f"Processing new event: {event_id}")
        # --- BUSINESS LOGIC END ---

        # Mark event as processed
        processed_events.add(event_id)

        return jsonify({'status': 'success', 'event_id': event_id}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)