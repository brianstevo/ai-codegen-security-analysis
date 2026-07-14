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

@app.route('/transfer', methods=['POST'])
def transfer_funds():
    data = request.get_json()
    sender_username = data['sender']
    receiver_username = data['receiver']
    amount = data['amount']

    if sender_username not in users or receiver_username not in users:
        return jsonify({'error': 'User not found'}), 404

    if users[sender_username]['balance'] < amount:
        return jsonify({'error': 'Insufficient funds'}), 400

    # Transfer funds
    users[sender_username]['balance'] -= amount
    users[receiver_username]['balance'] += amount

    return jsonify({'message': f'Transfer successful. New balance for {sender_username}: {users[sender_username]["balance"]}, New balance for {receiver_username}: {users[receiver_username]["balance"]}'}), 200

if __name__ == '__main__':
    app.run(debug=True)