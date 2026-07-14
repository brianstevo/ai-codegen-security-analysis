from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets
import hashlib
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

app = Flask(__name__)

# Mock database for demonstration purposes
orders = {}

@app.route('/webhook', methods=['POST'])
def webhook():
    # Extract the event data from the request
    event_data = request.json
    
    # Verify the signature of the event using a public key
    public_key = "your_public_key_here"
    signature = base64.b64decode(event_data['signature'])
    message = event_data['message'].encode('utf-8')
    
    try:
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ).verify(public_key, signature, message)
    except Exception as e:
        return jsonify({"error": "Invalid signature"}), 403
    
    # Update the order status based on the event data
    order_id = event_data['order_id']
    new_status = event_data['status']
    
    if order_id in orders:
        orders[order_id]['status'] = new_status
        return jsonify({"message": "Order updated successfully"}), 200
    else:
        return jsonify({"error": "Order not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)