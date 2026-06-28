from flask import Flask, request, jsonify
from functools import wraps
import jwt
import bcrypt
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-super-secret-key'

# Mock Database
accounts = {
    "user1": {"balance": 1000.0, "password": bcrypt.hashpw(b"pass1", bcrypt.gensalt())},
    "user2": {"balance": 500.0, "password": bcrypt.hashpw(b"pass2", bcrypt.gensalt())},
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            # Expecting "Bearer <token>"
            token = token.split(" ")[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data['user_id']
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/transfer', methods=['POST'])
@token_required
def transfer_funds(current_user):
    """
    Handles fund transfers between accounts.
    Payload: { "receiver_id": str, "amount": float }
    """
    data = request.get_json()

    if not data or 'receiver_id' not in data or 'amount' not in data:
        return jsonify({'error': 'Missing receiver_id or amount'}), 400

    receiver_id = data['receiver_id']
    try:
        amount = float(data['amount'])
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount format'}), 400

    if amount <= 0:
        return jsonify({'error': 'Transfer amount must be positive'}), 400

    if current_user == receiver_id:
        return jsonify({'error': 'Cannot transfer funds to yourself'}), 400

    # Check if accounts exist
    if current_user not in accounts:
        return jsonify({'error': 'Sender account not found'}), 404
    if receiver_id not in accounts:
        return jsonify({'error': 'Receiver account not found'}), 404

    sender_account = accounts[current_user]
    receiver_account = accounts[receiver_id]

    # Check for sufficient funds
    if sender_account['balance'] < amount:
        return jsonify({'error': 'Insufficient funds'}), 400

    # Atomic-like transaction simulation
    try:
        sender_account['balance'] -= amount
        receiver_account['balance'] += amount
        
        return jsonify({
            'message': 'Transfer successful',
            'transaction_details': {
                'from': current_user,
                'to': receiver_id,
                'amount': amount,
                'new_balance': sender_account['balance'],
                'timestamp': datetime.utcnow().isoformat()
            }
        }), 200
    except Exception as e:
        # In a real DB, you would use db.session.rollback() here
        return jsonify({'error': 'Internal server error during transaction'}), 500

@app.route('/login', methods=['POST'])
def login():
    """Helper route to generate JWT for testing the transfer route"""
    auth = request.get_json()
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Could not verify'}), 401

    user = accounts.get(auth['username'])
    if user and bcrypt.checkpw(auth['password'].encode('utf-8'), user['password']):
        token = jwt.encode({
            'user_id': auth['username'],
            'exp': datetime.utcnow() + timedelta(hours=1)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({'token': token})

    return jsonify({'message': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)