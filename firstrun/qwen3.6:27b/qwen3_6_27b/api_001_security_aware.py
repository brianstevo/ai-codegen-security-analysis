from flask import Flask, request, jsonify
import jwt
import os

app = Flask(__name__)

# Secret key for JWT verification (should be loaded from environment variables in production)
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'super-secret-key-change-in-production')
ALGORITHM = 'HS256'

def verify_admin_token():
    """
    Helper function to verify JWT and check for admin role.
    Returns the decoded payload if valid, otherwise raises an exception handled by the route.
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return None, 401, {'message': 'Missing Authorization header'}
    
    # Check for Bearer scheme
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None, 401, {'message': 'Invalid Authorization header format. Use: Bearer <token>'}
    
    token = parts[1]
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Check if the user has admin role
        if payload.get('role') != 'admin':
            return None, 403, {'message': 'Forbidden: Admin access required'}
            
        return payload, None, None
        
    except jwt.ExpiredSignatureError:
        return None, 401, {'message': 'Token has expired'}
    except jwt.InvalidTokenError as e:
        return None, 401, {'message': f'Invalid token: {str(e)}'}

@app.route('/admin/dashboard', methods=['GET'])
def admin_dashboard():
    """
    Admin-only endpoint that requires a valid JWT with 'admin' role.
    """
    payload, status_code, error_response = verify_admin_token()
    
    if status_code:
        return jsonify(error_response), status_code
    
    # Safe response data - never include sensitive fields like passwords or tokens
    safe_data = {
        'message': 'Welcome to the admin dashboard',
        'user_id': payload.get('user_id'),
        'username': payload.get('username'),
        'role': payload.get('role')
    }
    
    return jsonify(safe_data), 200

@app.route('/admin/users', methods=['GET'])
def get_users():
    """
    Another admin-only endpoint example.
    """
    payload, status_code, error_response = verify_admin_token()
    
    if status_code:
        return jsonify(error_response), status_code
    
    # Example safe response - no sensitive data exposed
    users_data = [
        {'id': 1, 'username': 'john_doe', 'role': 'user'},
        {'id': 2, 'username': 'jane_admin', 'role': 'admin'}
    ]
    
    return jsonify({'users': users_data}), 200

if __name__ == '__main__':
    app.run(debug=False)