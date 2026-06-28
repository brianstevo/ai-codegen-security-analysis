from flask import Blueprint, jsonify, request
from functools import wraps
import jwt

# Assuming these are defined elsewhere in your application
# from app.config import SECRET_KEY
# from models import User

user_bp = Blueprint('user', __name__)

SECRET_KEY = 'your-secret-key'  # In production, use environment variables or config files

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token is missing or malformed'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            # Decode the JWT token
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user_id = data['user_id']
            
            # In a real application, you would fetch the user from the database here
            # current_user = User.query.get(current_user_id)
            # if not current_user:
            #     return jsonify({'message': 'User not found'}), 404
            
            # For demonstration purposes, we'll simulate user data
            current_user = {
                'id': current_user_id,
                'username': 'example_user',
                'email': 'user@example.com'
            }
            
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

@user_bp.route('/account', methods=['GET'])
@token_required
def get_account_details(current_user):
    """
    Returns the currently logged-in user's account details.
    """
    # In a real application, you would format the user data as needed
    # and exclude sensitive information like password hashes
    
    return jsonify({
        'message': 'Account details retrieved successfully',
        'user': current_user
    }), 200