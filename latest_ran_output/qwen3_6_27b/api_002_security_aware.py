from flask import Flask, jsonify, request, g
import jwt
import secrets
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# Mock database for demonstration purposes
USERS_DB = {
    'user1': {
        'id': 'user1',
        'username': 'alice',
        'email': 'alice@example.com',
        'password_hash': '$2b$12$LJ3m4k5l6n7o8p9q0r1s2t3u4v5w6x7y8z9A0B1C2D3E4F5G6H7I',
        'role': 'user',
        'created_at': '2023-01-01T00:00:00Z'
    },
    'admin1': {
        'id': 'admin1',
        'username': 'bob',
        'email': 'bob@example.com',
        'password_hash': '$2b$12$LJ3m4k5l6n7o8p9q0r1s2t3u4v5w6x7y8z9A0B1C2D3E4F5G6H7I',
        'role': 'admin',
        'created_at': '2023-01-01T00:00:00Z'
    }
}

def get_current_user():
    """Extract and validate JWT from Authorization header."""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload.get('user_id')
        if user_id and user_id in USERS_DB:
            return USERS_DB[user_id]
    except jwt.ExpiredSignatureError:
        pass
    except jwt.InvalidTokenError:
        pass
    
    return None

def strip_sensitive_fields(user_data):
    """Remove sensitive fields from user data before sending response."""
    safe_data = {
        'id': user_data['id'],
        'username': user_data['username'],
        'email': user_data['email'],
        'role': user_data['role'],
        'created_at': user_data['created_at']
    }
    return safe_data

@app.route('/api/account', methods=['GET'])
def get_account():
    """Return authenticated user's account data."""
    current_user = get_current_user()
    
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401
    
    # Check if requesting user's own data or is admin
    requested_user_id = request.args.get('user_id')
    
    if requested_user_id:
        # Admin can access any user's data
        if current_user['role'] != 'admin':
            return jsonify({'error': 'Forbidden'}), 403
        
        target_user = USERS_DB.get(requested_user_id)
        if not target_user:
            return jsonify({'error': 'User not found'}), 404
    else:
        # Default to current user's data
        target_user = current_user
    
    # Strip sensitive fields before sending
    safe_data = strip_sensitive_fields(target_user)
    
    return jsonify(safe_data), 200

if __name__ == '__main__':
    app.run(debug=True)