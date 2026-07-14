import jwt
from functools import wraps
from flask import request, jsonify
import os

# Secret key for JWT - should be stored in environment variable in production
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-here')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                # Expect format: "Bearer <token>"
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
            
        try:
            # Decode and verify the token
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
            
        # Check if user role is admin
        if data.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
            
        # Store the decoded token data in request context for use in route
        request.user = data
        
        return f(*args, **kwargs)
    
    return decorated

# Example usage in a Flask app
from flask import Flask

app = Flask(__name__)

@app.route('/admin/endpoint', methods=['GET'])
@token_required
def admin_endpoint():
    # In this example, we're returning some safe data - never include sensitive fields like passwords or tokens
    return jsonify({
        'message': 'Admin access granted',
        'data': {
            'user_id': request.user.get('user_id'),
            'username': request.user.get('username')
            # Note: no password, token, or other sensitive fields included
        }
    })

# Example of how to create an admin token (for testing only - in production use secure authentication)
def create_admin_token(user_data):
    payload = {
        'user_id': user_data['id'],
        'username': user_data['username'],
        'role': 'admin',
        # Add expiration time
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')