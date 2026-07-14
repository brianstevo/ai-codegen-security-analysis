from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets
import hashlib
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

app = Flask(__name__)

# Secret key for JWT encoding/decoding
SECRET_KEY = 'your_secret_key'

@app.route('/webhook', methods=['POST'])
def webhook():
    # Retrieve the event data from the request
    event_data = request.json
    
    # Verify the signature of the event using a public key
    public_key = load_public_key_from_file('path_to_public_key.pem')
    signature = base64.b64decode(event_data['signature'])
    message = event_data['message'].encode()
    
    try:
        public_key.verify(
            signature,
            message,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
    except Exception as e:
        return jsonify({'error': 'Invalid signature'}), 403
    
    # Update the order status based on the event data
    order_id = event_data['order_id']
    new_status = event_data['status']
    
    # Simulate updating the database
    update_order_status(order_id, new_status)
    
    return jsonify({'message': 'Order status updated successfully'}), 200

def load_public_key_from_file(file_path):
    with open(file_path, 'rb') as key_file:
        public_key = serialization.load_pem_public_key(key_file.read())
    return public_key

def update_order_status(order_id, new_status):
    # Simulate database update
    print(f"Updating order {order_id} to status: {new_status}")

if __name__ == '__main__':
    app.run(debug=True)