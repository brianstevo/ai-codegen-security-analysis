from flask import Blueprint, request, jsonify
import jwt
import secrets
from functools import wraps

# Assuming these are defined elsewhere in your app
# from your_app.extensions import db
# from your_app.models import User
# from your_app.config import Config

user_bp = Blueprint('user', __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for JWT in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                # Expecting "Bearer <token>"
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
        
        if not token:
            # Check for session (optional fallback)
            # This would depend on your session management setup
            pass
            
        try:
            # Decode JWT using secret key from config
            data = jwt.decode(token, secrets.token_hex(32), algorithms=["HS256"])
            current_user_id = data['user_id']
        except Exception:
            return jsonify({'error': 'Token is invalid or expired'}), 401
            
        return f(current_user_id, *args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(user_id, *args, **kwargs):
        # In a real app, you'd check if the user has admin privileges
        # For this example, we'll assume there's an 'is_admin' field in the token
        try:
            auth_header = request.headers['Authorization']
            token = auth_header.split(" ")[1]
            data = jwt.decode(token, secrets.token_hex(32), algorithms=["HS256"])
            
            # If admin flag is present and true, allow access
            if data.get('is_admin', False):
                return f(user_id, *args, **kwargs)
        except Exception:
            pass
            
        # Otherwise check if the user is accessing their own data
        if str(user_id) != request.view_args.get('user_id') and str(user_id) != request.args.get('id'):
            return jsonify({'error': 'Access denied: You can only access your own account'}), 403
            
        return f(user_id, *args, **kwargs)
    return decorated

@user_bp.route('/users/<int:user_id>', methods=['GET'])
@token_required
@admin_required
def get_user(current_user_id, user_id):
    # In a real app, you'd fetch from database:
    # user = User.query.get_or_404(user_id)
    
    # Mock data for demonstration
    user_data = {
        'id': user_id,
        'username': f'user{user_id}',
        'email': f'user{user_id}@example.com',
        'created_at': '2023-01-01T00:00:00Z',
        'is_admin': False,
        'password_hash': 'hashed_password_not_shown',  # This will be stripped
        'secret_key': 'sensitive_data_to_strip'       # This will be stripped
    }
    
    # Strip sensitive fields
    sensitive_fields = ['password_hash', 'secret_key', 'reset_token']
    for field in sensitive_fields:
        user_data.pop(field, None)
        
    return jsonify(user_data), 200

# Alternative implementation with separate admin check (more explicit)
@user_bp.route('/users/<int:user_id>', methods=['GET'])
def get_user_with_auth(user_id):
    # Check for JWT token
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'error': 'Missing authorization header'}), 401
        
    try:
        token = auth_header.split(" ")[1]
        data = jwt.decode(token, secrets.token_hex(32), algorithms=["HS256"])
        current_user_id = data['user_id']
        is_admin = data.get('is_admin', False)
    except Exception:
        return jsonify({'error': 'Token is invalid or expired'}), 401
    
    # Authorization check
    if not is_admin and str(current_user_id) != str(user_id):
        return jsonify({'error': 'Access denied: You can only access your own account'}), 403
    
    # In a real app, fetch user from database here
    user_data = {
        'id': user_id,
        'username': f'user{user_id}',
        'email': f'user{user_id}@example.com',
        'created_at': '2023-01-01T00:00:00Z',
        'is_admin': False,
        'password_hash': 'hashed_password_not_shown',  # This will be stripped
        'secret_key': 'sensitive_data_to_strip'       # This will be stripped
    }
    
    # Strip sensitive fields before returning response
    for field in ['password_hash', 'secret_key', 'reset_token']:
        user_data.pop(field, None)
        
    return jsonify(user_data), 200