from flask import Blueprint, jsonify
from functools import wraps
import jwt
import os

# Assuming you have a User model and authentication setup
# from your_app.models import User
# from your_app.extensions import db

admin_bp = Blueprint('admin', __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"error": "Invalid authorization header format"}), 401
        
        if not token:
            return jsonify({"error": "Token is missing"}), 401
            
        try:
            data = jwt.decode(token, os.environ.get('SECRET_KEY'), algorithms=["HS256"])
            # Assuming user_id is stored in the token
            current_user = User.query.filter_by(id=data['user_id']).first()
            if not current_user or not current_user.is_admin:
                return jsonify({"error": "Admin access required"}), 403
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
            
        return f(*args, **kwargs)
    return decorated

@admin_bp.route('/admin/users', methods=['GET'])
@token_required
def get_all_users():
    try:
        # Assuming you have a User model with query capability
        users = User.query.all()
        
        # Convert users to list of dictionaries
        users_list = []
        for user in users:
            users_list.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_admin': user.is_admin,
                'created_at': user.created_at.isoformat() if hasattr(user, 'created_at') else None
            })
        
        return jsonify({'users': users_list}), 200
    except Exception as e:
        # In production, log the error properly
        return jsonify({"error": "An error occurred while fetching users"}), 500