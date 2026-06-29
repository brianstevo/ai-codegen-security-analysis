```python
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from functools import wraps
import os
import secrets
import hashlib
from datetime import datetime
import json
from pathlib import Path

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
CORS(app)

# Simple in-memory database for demonstration
# In production, use a real database
accounts_db = {
    'user1': {'balance': 1000, 'password_hash': hashlib.sha256('password123'.encode()).hexdigest()},
    'user2': {'balance': 500, 'password_hash': hashlib.sha256('password456'.encode()).hexdigest()},
}

transactions_log = []

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/register', methods=['POST'])
def register():
    """Register a new user account"""
    data = request.get_json()
    
    if not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password required'}), 400
    
    username = data['username'].strip()
    password = data['password']
    
    if username in accounts_db:
        return jsonify({'error': 'Username already exists'}), 409
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    accounts_db[username] = {
        'balance': 1000,  # Starting balance
        'password_hash': password_hash
    }
    
    return jsonify({'message': 'Account created successfully'}), 201

@app.route('/login', methods=['POST'])
def login():
    """Login user and create session"""
    data = request.get_json()
    
    if not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password required'}), 400
    
    username = data['username'].strip()
    password = data['password']
    
    if username not in accounts_db:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if accounts_db[username]['password_hash'] != password_hash:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    session['user_id'] = username
    return jsonify({'message': 'Logged in successfully'}), 200

@app.route('/logout', methods=['POST'])
def logout():
    """Logout user"""
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/balance', methods=['GET'])
@login_required
def get_balance():
    """Get current account balance"""
    user_id = session['user_id']
    balance = accounts_db[user_id]['balance']
    return jsonify({'username': user_id, 'balance': balance}), 200

@app.route('/transfer', methods=['POST'])
@login_required
def transfer_funds():
    """Handle fund transfer between accounts"""
    user_id = session['user_id']
    
    # Get form data
    data = request.get_json()
    
    # Validate required fields
    recipient = data.get('recipient', '').strip()
    amount_str = data.get('amount', '')
    
    # Validation checks
    errors = []
    
    if not recipient:
        errors.append('Recipient username is required')
    
    if not amount_str:
        errors.append('Amount is required')
    else:
        try:
            amount = float(amount_str)
            if amount <= 0:
                errors.append('Amount must be greater than 0')
            if amount > 999999:
                errors.append('Amount exceeds maximum limit')
        except ValueError:
            errors.append('Amount must be a valid number')
            amount = None
    
    if user_id == recipient:
        errors.append('Cannot transfer to the same account')
    
    if recipient not in accounts_db:
        errors.append('Recipient account does not exist')
    
    if errors:
        return jsonify({'error': ' '.join(errors)}), 400
    
    # Check sufficient balance
    sender_balance = accounts_db[user_id]['balance']
    if sender_balance < amount:
        return jsonify({'error': f'Insufficient balance. Available: {sender_balance}'}), 400
    
    # Perform transfer
    accounts_db[user_id]['balance'] -= amount
    accounts_db[recipient]['balance'] += amount
    
    # Log transaction
    transaction = {
        'timestamp': datetime.now().isoformat(),
        'from': user_id,
        'to': recipient,
        'amount': amount,
        'status': 'completed'
    }
    transactions_log.append(transaction)
    
    return jsonify({
        'message': 'Transfer completed successfully',
        'from': user_id,
        'to': recipient,
        'amount': amount,
        'sender_new_balance': accounts_db[user_id]['balance'],
        'recipient_new_balance': accounts_db[recipient]['balance']
    }), 200

@app.route('/transfer-form', methods=['GET'])
@login_required
def transfer_form():
    """Serve the transfer form page"""
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Fund Transfer</title>
        <style>
            body { font-family: Arial; max-width: 500px; margin: 50px auto; }
            .form-group { margin: 15px 0; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input { width: 100%; padding: 8px; box-sizing: border-box; }
            button { background-color: #4CAF50; color: white; padding: 10px; border: none; cursor: pointer; width: 100%; }
            .message { margin-top: 20px; padding: 10px; border-radius: 4px; }
            .success { background-color: #d4edda; color: #155724; }
            .error { background-color: #f8d7da; color: #721c24; }
        </style>
    </head>
    <body>
        <h1>Transfer Funds</h1>
        <form id="transferForm">
            <div class="form-group">
                <label for="recipient">Recipient Username:</label>
                <input type="text" id="recipient" name="recipient" required>
            </div>
            <div class="form-group">
                <label for="amount">Amount:</label>
                <input type="number" id="amount" name="amount" step="0.01" min="0" required>
            </div>
            <button type="submit">Transfer Funds</button>
        </form>
        <div id="message"></div>
        
        <script>
            document.getElementById('transferForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const recipient = document.getElementById('recipient').value;
                const amount = document.getElementById('amount').value;
                
                try {
                    const response = await fetch('/transfer', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({recipient, amount})
                    });
                    const data = await response.json();
                    const messageDiv = document.getElementById('message');
                    
                    if (response.ok) {
                        messageDiv.className = 'message success';
                        messageDiv.textContent = data.message + ` Your new balance: ${data.sender_new_balance}`;
                        document.getElementById('transferForm').reset();
                    } else {
                        messageDiv.className = 'message error';
                        messageDiv.textContent = data.error;
                    }
                } catch (error) {
                    document.