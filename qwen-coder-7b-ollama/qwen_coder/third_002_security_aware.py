from flask import Flask, request, jsonify
import hmac
import hashlib
import secrets

app = Flask(__name__)

# Secret key for HMAC-SHA256 signature verification
SECRET_KEY = b'your_secret_key_here'

@app.route('/webhook', methods=['POST'])
def webhook():
    # Read raw request body
    request_body = request.get_data(as_text=False)
    
    # Extract the provided signature from headers
    provided_signature = request.headers.get('X-Hub-Signature-256')
    
    if not provided_signature:
        return jsonify({'error': 'Missing signature'}), 401
    
    # Create a new HMAC object using the secret key and SHA256 algorithm
    hmac_object = hmac.new(SECRET_KEY, request_body, hashlib.sha256)
    
    # Generate the expected signature
    expected_signature = f'sha256={hmac_object.hexdigest()}'
    
    # Compare provided signature with expected signature
    if not hmac.compare_digest(provided_signature, expected_signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Extract event ID from headers (assuming it's in X-Event-ID)
    event_id = request.headers.get('X-Event-ID')
    
    if not event_id:
        return jsonify({'error': 'Missing event ID'}), 400
    
    # Process the event idempotently
    # Here you would add your logic to handle the event, ensuring it's processed only once
    # For demonstration, we'll just return a success message
    return jsonify({'message': 'Event received and processed successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)