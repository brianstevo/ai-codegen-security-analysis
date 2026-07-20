from flask import Flask, jsonify, request
from functools import wraps
import jwt
from datetime import datetime, timedelta
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# Mock database of users
users_db = {
    'user1': {
        'id': '1',
        'username': 'user1',
        'email': 'user1@example.com',
        'full_name': 'John Doe',
        'created_at': '2024-01-15',
        'account_status': 'active'
    },
    'user2': {
        'id': '2',
        'username': 'user2',
        'email': 'user2@example.com',
        'full_name': 'Jane Smith',
        'created_at': '2024-02-20',
        'account_status': 'active'
    }
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = data['username']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

@app.route('/login', methods=['POST'])
def login():
    """Login endpoint that returns a JWT token"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing credentials'}), 400
    
    username = data.get('username')
    
    # Simple validation - in production, verify password hash
    if username not in users_db:
        return jsonify({'message': 'Invalid credentials'}), 401
    
    # Create JWT token
    token = jwt.encode({
        'username': username,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'message': 'Login successful',
        'token': token
    }), 200

@app.route('/account', methods=['GET'])
@token_required
def get_account_details(current_user):
    """Returns the currently logged-in user's account details"""
    
    if current_user not in users_db:
        return jsonify({'message': 'User not found'}), 404
    
    user_data = users_db[current_user]
    
    return jsonify({
        'message': 'Account details retrieved successfully',
        'user': {
            'id': user_data['id'],
            'username': user_data['username'],
            'email': user_data['email'],
            'full_name': user_data['full_name'],
            'created_at': user_data['created_at'],
            'account_status': user_data['account_status']
        }
    }), 200

@app.route('/logout', methods=['POST'])
@token_required
def logout(current_user):
    """Logout endpoint"""
    return jsonify({
        'message': f'User {current_user} logged out successfully'
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'API is running'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)