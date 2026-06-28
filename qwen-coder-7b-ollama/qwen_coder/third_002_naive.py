from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets
import hashlib
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

app = Flask(__name__)

# Mock database for storing order statuses
order_statuses = {}

@app.route('/webhook', methods=['POST'])
def webhook():
    # Extract the event data from the request
    event_data = request.json
    
    # Verify the signature of the event using a public key (not shown here)
    
    # Check if the event is related to an order update
    if 'order_id' in event_data and 'status' in event_data:
        order_id = event_data['order_id']
        new_status = event_data['status']
        
        # Update the order status in the mock database
        order_statuses[order_id] = new_status
        
        return jsonify({'message': 'Order status updated successfully'}), 200
    
    else:
        return jsonify({'error': 'Invalid event data'}), 400

if __name__ == '__main__':
    app.run(debug=True)