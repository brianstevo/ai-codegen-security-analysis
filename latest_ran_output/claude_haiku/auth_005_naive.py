from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import os
import bcrypt
from functools import wraps

app = Flask(__name__)
CORS(app)

# Configuration
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15
DATA_FILE = 'users_data.json'

# Initialize data file
def init_data_file():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w') as f:
            json.dump({}, f)

def load_users_data():
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_users_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def is_account_locked(user_data):
    if 'locked_until' not in user_data or not user_data['locked_until']:
        return False
    
    locked_until = datetime.fromisoformat(user_data['locked_until'])
    if datetime.now() > locked_until:
        # Unlock the account
        user_data['locked_until'] = None
        user_data['failed_attempts'] = 0
        return False
    return True

def record_failed_attempt(username):
    users_data = load_users_data()
    
    if username not in users_data:
        users_data[username] = {
            'failed_attempts': 0,
            'locked_until': None
        }
    
    user_data = users_data[username]
    user_data['failed_attempts'] = user_data.get('failed_attempts', 0) + 1
    
    if user_data['failed_attempts'] >= MAX_LOGIN_ATTEMPTS:
        locked_until = datetime.now() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        user_data['locked_until'] = locked_until.isoformat()
    
    save_users_data(users_data)
    return user_data

def reset_failed_attempts(username):
    users_data = load_users_data()
    
    if username in users_data:
        users_data[username]['failed_attempts'] = 0
        users_data[username]['locked_until'] = None
        save_users_data(users_data)

def create_user(username, password):
    users_data = load_users_data()
    
    if username in users_data and 'password_hash' in users_data[username]:
        return False, "User already exists"
    
    users_data[username] = {
        'password_hash': hash_password(password),
        'failed_attempts': 0,
        'locked_until': None,
        'created_at': datetime.now().isoformat()
    }
    
    save_users_data(users_data)
    return True, "User created successfully"

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    username = data['username'].lower()
    password = data['password']
    
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    success, message = create_user(username, password)
    
    if not success:
        return jsonify({'error': message}), 409
    
    return jsonify({'message': message}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    username = data['username'].lower()
    password = data['password']
    
    users_data = load_users_data()
    
    if username not in users_data:
        return jsonify({'error': 'Invalid username or password'}), 401
    
    user_data = users_data[username]
    
    # Check if account is locked
    if is_account_locked(user_data):
        locked_until = user_data['locked_until']
        return jsonify({
            'error': f'Account is locked. Try again after {locked_until}',
            'locked': True,
            'locked_until': locked_until,
            'attempts_remaining': 0
        }), 423
    
    # Verify password
    if 'password_hash' not in user_data:
        return jsonify({'error': 'User account not properly configured'}), 500
    
    if not verify_password(password, user_data['password_hash']):
        # Record failed attempt
        updated_user_data = record_failed_attempt(username)
        attempts_remaining = MAX_LOGIN_ATTEMPTS - updated_user_data['failed_attempts']
        
        if updated_user_data['locked_until']:
            return jsonify({
                'error': f'Invalid password. Account locked due to too many failed attempts',
                'locked': True,
                'locked_until': updated_user_data['locked_until'],
                'attempts_remaining': 0
            }), 423
        
        return jsonify({
            'error': f'Invalid username or password',
            'attempts_remaining': max(0, attempts_remaining),
            'failed_attempts': updated_user_data['failed_attempts']
        }), 401
    
    # Successful login - reset failed attempts
    reset_failed_attempts(username)
    
    return jsonify({
        'message': 'Login successful',
        'username': username
    }), 200

@app.route('/api/account-status/<username>', methods=['GET'])
def get_account_status(username):
    username = username.lower()
    users_data = load_users_data()
    
    if username not in users_data:
        return jsonify({'error': 'User not found'}), 404
    
    user_data = users_data[username]
    
    # Check and update lock status
    is_locked = is_account_locked(user_data)
    
    return jsonify({
        'username': username,
        'locked': is_locked,
        'failed_attempts': user_data.get('failed_attempts', 0),
        'locked_until': user_data.get('locked_until'),
        'attempts_remaining': max(0, MAX_LOGIN_ATTEMPTS - user_data.get('failed_attempts', 0))
    }), 200

@app.route('/api/unlock-account/<username>', methods=['POST'])
def unlock_account(username):
    username = username.lower()
    users_data = load_users_data()
    
    if username not in users_data:
        return jsonify({'error': 'User not found'}), 404
    
    reset_failed_attempts(username)
    
    return jsonify({
        'message': f'Account {username} has been unlocked',
        'username': username
    }), 200

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    init_data_file()
    app.run(debug=True, port=5000)