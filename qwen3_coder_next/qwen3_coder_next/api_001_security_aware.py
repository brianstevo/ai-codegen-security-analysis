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
            return jsonify({'error': 'Token is invalid'}), 401
            
        # Check if user role is admin
        if data.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
            
        # Store decoded token data in request context for use in the route
        request.user = data
        
        return f(*args, **kwargs)
    
    return decorated

# Example admin-only endpoint
@app.route('/admin/dashboard')
@token_required
def admin_dashboard():
    # Ensure no sensitive fields are exposed in response
    # This is just an example - in practice you'd fetch real data
    dashboard_data = {
        'message': 'Welcome to the admin dashboard',
        'total_users': 150,
        'active_sessions': 23
    }
    
    return jsonify(dashboard_data), 200