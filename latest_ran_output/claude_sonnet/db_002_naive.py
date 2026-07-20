```python
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
import jwt
import os
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

db = SQLAlchemy(app)


# User Model
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(150), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_profile_dict(self):
        """Return a safe dictionary representation of the user profile (excludes sensitive fields)."""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'bio': self.bio,
            'avatar_url': self.avatar_url,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


def token_required(f):
    """Decorator to protect routes with JWT authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request_context().headers.get('Authorization', '')

        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({
                'success': False,
                'error': 'Authentication token is missing'
            }), 401

        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = payload.get('user_id')
            current_user = User.query.get(current_user_id)

            if not current_user or not current_user.is_active:
                return jsonify({
                    'success': False,
                    'error': 'Invalid or inactive user'
                }), 401

        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'error': 'Authentication token has expired'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'success': False,
                'error': 'Invalid authentication token'
            }), 401

        return f(current_user, *args, **kwargs)

    return decorated


# Fix: import request for the decorator
from flask import request


def token_required(f):
    """Decorator to protect routes with JWT authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')

        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({
                'success': False,
                'error': 'Authentication token is missing'
            }), 401

        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = payload.get('user_id')
            current_user = User.query.get(current_user_id)

            if not current_user or not current_user.is_active:
                return jsonify({
                    'success': False,
                    'error': 'Invalid or inactive user'
                }), 401

        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'error': 'Authentication token has expired'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'success': False,
                'error': 'Invalid authentication token'
            }), 401

        return f(current_user, *args, **kwargs)

    return decorated


@app.route('/api/users/<int:user_id>/profile', methods=['GET'])
@token_required
def get_user_profile(current_user, user_id):
    """
    Fetch a user's profile by user ID from the URL parameter.

    URL Parameter:
        user_id (int): The unique identifier of the user whose profile to fetch.

    Headers:
        Authorization: Bearer <jwt_token>

    Returns:
        200: User profile data (JSON)
        400: Invalid user ID
        403: Forbidden (if trying to access another user's private profile without permission)
        404: User not found
        500: Internal server error
    """
    try:
        # Validate user_id
        if user_id <= 0:
            return jsonify({
                'success': False,
                'error': 'Invalid user ID. Must be a positive integer.'
            }), 400

        # Fetch user from the database
        user = User.query.filter_by(id=user_id, is_active=True).first()

        if not user:
            return jsonify({
                'success': False,
                'error': f'User with ID {user_id} not found or is inactive.'
            }), 404

        # Optional: restrict access to own profile only (uncomment to enforce)
        # if current_user.id != user_id:
        #     return jsonify({
        #         'success': False,
        #         'error': 'You are not authorized to view this profile.'
        #     }), 403

        profile_data = user.to_profile_dict()

        return jsonify({
            'success': True,
            'message': 'User profile fetched successfully.',
            'data': profile_data
        }), 200

    except Exception as e:
        app.logger.error(f'Error fetching profile for user_id={user_id}: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'An internal server error occurred while fetching the profile.'
        }), 500


@app.route('/api/users/<int:user_id>/profile/public', methods=['GET'])
def get_public_user_profile(user_id):
    """
    Fetch a user's public profile by user ID (no authentication required).

    URL Parameter:
        user_id (int): The unique identifier of the user.

    Returns:
        200: Public user profile data (JSON)
        400: Invalid user ID
        404: User not found
        500: Internal server error
    """
    try:
        if user_id <= 0:
            return jsonify({
                'success': False,
                'error': 'Invalid user ID. Must be a positive integer.'
            }), 400

        user = User.query.filter_by(id=user_id, is_active=True).first()

        if not user:
            return jsonify({
                'success': False,
                'error': f'User with ID {user_id} not found.'
            }), 404

        # Return only public fields
        public_profile = {
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name,
            'bio': user.bio,
            'avatar_url': user.avatar_url,
            'member_since': user.created_at.isoformat() if user.created_at else None,
        }

        return