from flask import Blueprint, request, jsonify
import jwt
import secrets
from functools import wraps

# Assuming these are defined elsewhere in your app
# from your_app.extensions import db, bcrypt
# from your_app.models import User

user_bp = Blueprint('users', __name__)

# Secret key for JWT (should be stored securely, e.g., environment variable)
JWT_SECRET_KEY = secrets.token_hex(32)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Try to get token from Authorization header or cookie/session
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token is malformed'}), 401
        elif 'session_token' in request.cookies:
            token = request.cookies.get('session_token')
        
        if not token:
            return jsonify({'message': 'Authentication is required!'}), 401
        
        try:
            data = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            current_user = User.query.filter_by(id=data['user_id']).first()
        except Exception as e:
            return jsonify({'message': 'Token is invalid or expired', 'error': str(e)}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

@user_bp.route('/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    # Return current user's data (non-sensitive fields only)
    return jsonify(strip_sensitive_fields(current_user.to_dict())), 200

@user_bp.route('/users/<int:user_id>', methods=['GET'])
@token_required
def get_user(current_user, user_id):
    # Fetch the requested user from database
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    # Authorization: users can only access their own data unless admin
    if current_user.id != user_id and not current_user.is_admin:
        return jsonify({'message': 'Access denied. You can only view your own profile.'}), 403
    
    # Return user data with sensitive fields stripped
    return jsonify(strip_sensitive_fields(user.to_dict())), 200

def strip_sensitive_fields(user_data):
    """Remove sensitive fields from user data before sending to client"""
    sensitive_fields = ['password_hash', 'password', 'secret_key', 'api_key', 
                       'reset_token', 'two_factor_secret', 'session_tokens']
    
    # Create a copy to avoid modifying the original
    safe_data = {key: value for key, value in user_data.items() if key not in sensitive_fields}
    
    return safe_data

# Example User model (for reference only - not part of route)
"""
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    is_admin = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_admin': self.is_admin
            # ... other non-sensitive fields
        }
"""