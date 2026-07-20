```python
import os
import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify
from cryptography.fernet import Fernet
import bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Mock database for demonstration
users_db = {}
transactions_db = []
accounts_db = {}

# Encryption for sensitive data
cipher_suite = Fernet(Fernet.generate_key())


def hash_password(password):
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password, hashed):
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id):
    """Create a JWT token for the user."""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=24),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


def token_required(f):
    """Decorator to require JWT token for routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            token = token.split(' ')[1] if ' ' in token else token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(current_user_id, *args, **kwargs)
    
    return decorated


@app.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password') or not data.get('email'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    username = data.get('username')
    
    if username in users_db:
        return jsonify({'message': 'User already exists'}), 409
    
    user_id = f"user_{len(users_db) + 1}"
    hashed_password = hash_password(data.get('password'))
    
    users_db[username] = {
        'user_id': user_id,
        'password': hashed_password,
        'email': data.get('email'),
        'created_at': datetime.utcnow().isoformat()
    }
    
    # Create default account for user
    account_id = f"acc_{user_id}_{len(accounts_db) + 1}"
    accounts_db[account_id] = {
        'account_id': account_id,
        'user_id': user_id,
        'balance': 1000.00,  # Initial balance
        'account_number': f"1000{len(accounts_db) + 1:04d}",
        'created_at': datetime.utcnow().isoformat()
    }
    
    users_db[username]['accounts'] = [account_id]
    
    return jsonify({
        'message': 'User registered successfully',
        'user_id': user_id,
        'account_id': account_id
    }), 201


@app.route('/login', methods=['POST'])
def login():
    """Login a user and return JWT token."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing username or password'}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if username not in users_db:
        return jsonify({'message': 'Invalid credentials'}), 401
    
    user = users_db[username]
    
    if not verify_password(password, user['password']):
        return jsonify({'message': 'Invalid credentials'}), 401
    
    token = create_token(user['user_id'])
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user_id': user['user_id']
    }), 200


@app.route('/transfer', methods=['POST'])
@token_required
def transfer_funds(current_user_id):
    """Handle fund transfer between accounts."""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['from_account_id', 'to_account_id', 'amount', 'transaction_pin']
    if not data or not all(field in data for field in required_fields):
        return jsonify({'message': f'Missing required fields: {", ".join(required_fields)}'}), 400
    
    from_account_id = data.get('from_account_id')
    to_account_id = data.get('to_account_id')
    amount = data.get('amount')
    transaction_pin = data.get('transaction_pin')
    memo = data.get('memo', '')
    
    # Validate amount
    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({'message': 'Amount must be positive'}), 400
    except (TypeError, ValueError):
        return jsonify({'message': 'Invalid amount format'}), 400
    
    # Check if from_account exists and belongs to current user
    if from_account_id not in accounts_db:
        return jsonify({'message': 'Source account not found'}), 404
    
    from_account = accounts_db[from_account_id]
    if from_account['user_id'] != current_user_id:
        return jsonify({'message': 'Unauthorized: Account does not belong to user'}), 403
    
    # Check if to_account exists
    if to_account_id not in accounts_db:
        return jsonify({'message': 'Destination account not found'}), 404
    
    to_account = accounts_db[to_account_id]
    
    # Verify transaction PIN (simplified for demo)
    if not transaction_pin or len(transaction_pin) < 4:
        return jsonify({'message': 'Invalid transaction PIN'}), 400
    
    # Check sufficient balance
    if from_account['balance'] < amount:
        return jsonify({
            'message': 'Insufficient balance',
            'available_balance': from_account['balance'],
            'requested_amount': amount
        }), 400
    
    # Check for same account transfer
    if from_account_id == to_account_id:
        return jsonify({'message': 'Cannot transfer to the same account'}), 400
    
    # Perform the transfer
    from_account['balance'] -= amount
    to_account['balance'] += amount
    
    # Record transaction
    transaction_id = f"txn_{len(transactions_db) + 1:06d}"
    transaction = {
        'transaction_id': transaction_id,
        'from_account_id': from_account_id,
        'to_account_id': to_account_id,
        'from_user_id': current_user_id,
        'to_user_id': to_account['user_id'],
        'amount': amount,
        'memo': memo,
        'timestamp': datetime.utcnow().isoformat(),
        'status': 'completed'
    }
    transactions_db.append(transaction)
    
    return jsonify({
        'message': 'Transfer successful',
        'transaction_id': transaction_id,
        'from_account': {
            'account_id': from_account_id,