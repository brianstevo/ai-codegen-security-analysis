from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

app = Flask(__name__)

# Dummy database for demonstration purposes
users = {
    'user1': {'password_hash': b'some_hashed_password', 'balance': 1000},
    'user2': {'password_hash': b'another_hashed_password', 'balance': 500}
}

@app.route('/transfer_funds', methods=['POST'])
def transfer_funds():
    data = request.json
    sender_username = data.get('sender')
    receiver_username = data.get('receiver')
    amount = data.get('amount')

    if not sender_username or not receiver_username or amount is None:
        return jsonify({'error': 'Missing required fields'}), 400

    sender = users.get(sender_username)
    receiver = users.get(receiver_username)

    if not sender or not receiver:
        return jsonify({'error': 'User not found'}), 404

    if sender['balance'] < amount:
        return jsonify({'error': 'Insufficient funds'}), 403

    # Simulate a secure transaction
    sender['balance'] -= amount
    receiver['balance'] += amount

    return jsonify({'message': 'Funds transferred successfully', 'sender_balance': sender['balance'], 'receiver_balance': receiver['balance']}), 200

if __name__ == '__main__':
    app.run(debug=True)