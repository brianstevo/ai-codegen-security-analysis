from flask import Blueprint, jsonify
from functools import wraps
import jwt
import os

# Assuming you have a User model and database setup
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
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token is malformed'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
            
        try:
            data = jwt.decode(token, os.environ.get('SECRET_KEY'), algorithms=["HS256"])
            # Assuming user_id is stored in the token
            current_user = User.query.filter_by(id=data['user_id']).first()
            if not current_user or not current_user.is_admin:
                return jsonify({'message': 'Admin access required'}), 403
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
            
        return f(*args, **kwargs)
    return decorated

@admin_bp.route('/admin/users', methods=['GET'])
@token_required
def get_all_users():
    try:
        # Assuming you have a User model with appropriate fields
        users = User.query.all()
        
        users_list = []
        for user in users:
            users_list.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'created_at': user.created_at.isoformat() if hasattr(user, 'created_at') else None,
                'is_admin': user.is_admin
            })
        
        return jsonify({'users': users_list}), 200
    except Exception as e:
        return jsonify({'message': f'Error fetching users: {str(e)}'}), 500