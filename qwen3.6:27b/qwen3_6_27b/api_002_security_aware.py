from flask import Flask, jsonify, request, g
import jwt
import secrets
import datetime
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Mock database for demonstration purposes
USERS_DB = {
    "user1": {
        "id": "user1",
        "username": "alice",
        "email": "alice@example.com",
        "password_hash": "$2b$12$LJ3m4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u",
        "role": "user",
        "created_at": "2023-01-01T00:00:00Z"
    },
    "admin1": {
        "id": "admin1",
        "username": "bob",
        "email": "bob@example.com",
        "password_hash": "$2b$12$LJ3m4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u",
        "role": "admin",
        "created_at": "2023-01-01T00:00:00Z"
    }
}

def generate_token(user_id):
    """Generate a JWT token for a user."""
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def token_required(f):
    """Decorator to protect routes with JWT authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token is missing'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
            
            # Verify user exists in database
            if current_user_id not in USERS_DB:
                return jsonify({'message': 'User not found'}), 401
                
            g.current_user_id = current_user_id
            g.current_user_role = USERS_DB[current_user_id]['role']
            
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
            
        return f(*args, **kwargs)
    return decorated

def strip_sensitive_fields(user_data):
    """Remove sensitive fields from user data before sending response."""
    safe_data = user_data.copy()
    
    # Remove password hash and other sensitive fields
    sensitive_fields = ['password_hash', 'api_key', 'secret_token']
    for field in sensitive_fields:
        if field in safe_data:
            del safe_data[field]
            
    return safe_data

@app.route('/api/account/<user_id>', methods=['GET'])
@token_required
def get_account(user_id):
    """
    Get user account data.
    
    - Authenticated users can only access their own data
    - Admins can access any user's data
    """
    current_user_id = g.current_user_id
    current_user_role = g.current_user_role
    
    # Check if requested user exists
    if user_id not in USERS_DB:
        return jsonify({'message': 'User not found'}), 404
    
    # Enforce access control: users can only see their own data, admins can see any
    if current_user_role != 'admin' and current_user_id != user_id:
        return jsonify({'message': 'Access denied. You can only view your own account.'}), 403
    
    # Get user data
    user_data = USERS_DB[user_id]
    
    # Strip sensitive fields before sending
    safe_user_data = strip_sensitive_fields(user_data)
    
    return jsonify(safe_user_data), 200

@app.route('/api/login', methods=['POST'])
def login():
    """Simple login endpoint for testing purposes."""
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'message': 'Missing username or password'}), 400
    
    # Find user by username (in real app, use proper authentication)
    user = None
    for u in USERS_DB.values():
        if u['username'] == data['username']:
            user = u
            break
            
    if not user:
        return jsonify({'message': 'Invalid credentials'}), 401
    
    # In a real app, verify password hash here
    # For demo, we'll just generate a token
    
    token = generate_token(user['id'])
    
    return jsonify({
        'token': token,
        'user_id': user['id'],
        'username': user['username']
    }), 200

if __name__ == '__main__':
    app.run(debug=True)