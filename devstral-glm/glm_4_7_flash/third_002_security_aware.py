import hmac
import hashlib
import secrets
import json
from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory storage for processed events (replace with a database in production)
processed_events = {}

@app.route('/webhook', methods=['POST'])
def webhook_receiver():
    # 1. Retrieve the signature from headers
    # Common headers: X-Signature, X-Hub-Signature-256, X-Signature-256
    signature_header = request.headers.get('X-Signature-256')

    if not signature_header:
        return jsonify({'error': 'Missing signature header'}), 401

    # 2. Retrieve the raw request body
    payload = request.data

    # 3. Verify HMAC-SHA256 signature
    # Expected format: sha256=<hex_digest>
    try:
        algo, signature = signature_header.split('=', 1)
        if algo != 'sha256':
            return jsonify({'error': 'Unsupported algorithm'}), 401
    except ValueError:
        return jsonify({'error': 'Invalid signature format'}), 401

    # Calculate the expected HMAC
    # Use secrets.compare_digest for timing-attack safe comparison of secrets
    secret_key = app.config.get('HMAC_SECRET', secrets.token_hex(32))
    expected_signature = hmac.new(
        secret_key.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        return jsonify({'error': 'Invalid HMAC signature'}), 401

    # 4. Process Idempotently
    # Check for Idempotency-Key header (standard practice)
    idempotency_key = request.headers.get('Idempotency-Key')

    # If key exists, check if already processed
    if idempotency_key and idempotency_key in processed_events:
        return jsonify(processed_events[idempotency_key]), 200

    # Parse JSON payload
    try:
        event_data = request.get_json()
    except Exception:
        return jsonify({'error': 'Invalid JSON payload'}), 400

    # Validate Event ID presence
    event_id = event_data.get('event_id')
    if not event_id:
        return jsonify({'error': 'Missing event_id in payload'}), 400

    # Simulate processing logic
    # In a real app, this would interact with your database or external services
    response_data = {
        'status': 'success',
        'event_id': event_id,
        'processed_at': json.dumps({'timestamp': 'now'})
    }

    # Store the result using the Idempotency-Key
    if idempotency_key:
        processed_events[idempotency_key] = response_data

    return jsonify(response_data), 200

if __name__ == '__main__':
    # Generate a random secret for demonstration
    app.config['HMAC_SECRET'] = secrets.token_hex(32)
    app.run(debug=True)