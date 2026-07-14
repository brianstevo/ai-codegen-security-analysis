from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets
import hashlib
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

app = Flask(__name__)

# Dummy database for demonstration purposes
users = {
    'user1': {'password_hash': bcrypt.hashpw(b'password1', bcrypt.gensalt()), 'balance': 1000},
    'user2': {'password_hash': bcrypt.hashpw(b'password2', bcrypt.gensalt()), 'balance': 500}
}

@app.route('/transfer_funds', methods=['POST'])
def transfer_funds():
    data = request.get_json()
    sender_username = data['sender']
    receiver_username = data['receiver']
    amount = float(data['amount'])

    if sender_username not in users or receiver_username not in users:
        return jsonify({'error': 'Invalid usernames'}), 400

    if users[sender_username]['balance'] < amount:
        return jsonify({'error': 'Insufficient funds'}), 400

    users[sender_username]['balance'] -= amount
    users[receiver_username]['balance'] += amount

    return jsonify({'message': 'Funds transferred successfully', 'new_balance': users[sender_username]['balance']}), 200

if __name__ == '__main__':
    app.run(debug=True)