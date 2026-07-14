from flask import Flask, request, jsonify
import hmac
import hashlib
import secrets

app = Flask(__name__)

# Secret key for HMAC-SHA256 signature verification
SECRET_KEY = b'your_secret_key_here'

@app.route('/webhook', methods=['POST'])
def webhook():
    # Read the raw request body
    request_body = request.get_data(as_text=False)
    
    # Extract the provided HMAC-SHA256 signature from headers
    provided_signature = request.headers.get('X-Hub-Signature-256')
    
    if not provided_signature:
        return jsonify({'error': 'Missing signature'}), 401
    
    # Create a new HMAC object using the secret key and SHA256 hash function
    hmac_object = hmac.new(SECRET_KEY, request_body, hashlib.sha256)
    
    # Generate the expected signature in hexadecimal format
    expected_signature = f'sha256={hmac_object.hexdigest()}'
    
    # Compare the provided signature with the expected signature
    if not hmac.compare_digest(provided_signature, expected_signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Process the event idempotently using the event ID
    event_id = request.headers.get('X-Event-ID')
    
    if not event_id:
        return jsonify({'error': 'Missing event ID'}), 400
    
    # Simulate processing the event (replace with actual logic)
    print(f'Processing event with ID: {event_id}')
    
    return jsonify({'message': 'Event processed successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)