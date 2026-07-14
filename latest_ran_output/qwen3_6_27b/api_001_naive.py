from flask import Flask, jsonify, request
from functools import wraps
import jwt
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-secret-key')

# Mock database for demonstration purposes
USERS_DB = [
    {"id": 1, "username": "admin", "email": "admin@example.com", "role": "admin"},
    {"id": 2, "username": "user1", "email": "user1@example.com", "role": "user"},
    {"id": 3, "username": "user2", "email": "user2@example.com", "role": "user"}
]

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check if token is in the request header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token is missing or malformed'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = USERS_DB.get(data['user_id'])
            
            # Check if user exists and has admin role
            if not current_user or current_user.get('role') != 'admin':
                return jsonify({'message': 'Admin privileges required'}), 403
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
            
        return f(*args, **kwargs)
    return decorated

@app.route('/admin/dashboard/users', methods=['GET'])
@token_required
def get_all_users():
    """
    Admin endpoint to retrieve all users.
    Requires valid JWT token with admin privileges.
    """
    try:
        # In a real application, you would query your database here
        return jsonify({
            'success': True,
            'users': USERS_DB,
            'count': len(USERS_DB)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'An error occurred while fetching users',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True)