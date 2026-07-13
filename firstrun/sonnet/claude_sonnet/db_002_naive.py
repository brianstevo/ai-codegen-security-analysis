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


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(200), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Serialize user object to dictionary (excluding sensitive fields)."""
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

    def __repr__(self):
        return f'<User {self.username}>'


def token_required(f):
    """Decorator to protect routes requiring authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request_context_token()

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({
                'success': False,
                'error': 'Authentication token is missing'
            }), 401

        try:
            payload = jwt.decode(
                token,
                app.config['SECRET_KEY'],
                algorithms=['HS256']
            )
            current_user_id = payload.get('user_id')
            if not current_user_id:
                raise jwt.InvalidTokenError('Invalid token payload')

        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'error': 'Token has expired'
            }), 401
        except jwt.InvalidTokenError as e:
            return jsonify({
                'success': False,
                'error': f'Invalid token: {str(e)}'
            }), 401

        return f(current_user_id, *args, **kwargs)

    return decorated


def request_context_token():
    """Helper to get Authorization header from request context."""
    from flask import request
    return request.headers.get('Authorization')


def validate_user_id(user_id):
    """Validate that the user_id is a positive integer."""
    try:
        uid = int(user_id)
        if uid <= 0:
            raise ValueError("User ID must be a positive integer")
        return uid
    except (ValueError, TypeError):
        return None


@app.route('/api/users/<user_id>/profile', methods=['GET'])
def get_user_profile(user_id):
    """
    Fetch a user's profile by user ID from the URL parameter.

    URL Parameters:
        user_id (int): The unique identifier of the user.

    Returns:
        JSON response with user profile data or error message.
    """
    # Validate user_id parameter
    validated_id = validate_user_id(user_id)
    if validated_id is None:
        return jsonify({
            'success': False,
            'error': 'Invalid user ID. Must be a positive integer.'
        }), 400

    try:
        # Fetch user from database
        user = db.session.get(User, validated_id)

        if user is None:
            return jsonify({
                'success': False,
                'error': f'User with ID {validated_id} not found'
            }), 404

        if not user.is_active:
            return jsonify({
                'success': False,
                'error': 'This user account is inactive'
            }), 403

        return jsonify({
            'success': True,
            'data': user.to_dict()
        }), 200

    except Exception as e:
        app.logger.error(f'Error fetching user profile for ID {validated_id}: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'An internal server error occurred while fetching the profile'
        }), 500


@app.route('/api/profile/<user_id>', methods=['GET'])
@token_required
def get_authenticated_user_profile(current_user_id, user_id):
    """
    Fetch a user's profile (authentication required).
    Only the authenticated user can view their own profile.

    URL Parameters:
        user_id (int): The unique identifier of the user.

    Headers:
        Authorization: Bearer <JWT token>

    Returns:
        JSON response with user profile data or error message.
    """
    # Validate user_id parameter
    validated_id = validate_user_id(user_id)
    if validated_id is None:
        return jsonify({
            'success': False,
            'error': 'Invalid user ID. Must be a positive integer.'
        }), 400

    # Ensure the authenticated user can only access their own profile
    if current_user_id != validated_id:
        return jsonify({
            'success': False,
            'error': 'You are not authorized to view this profile'
        }), 403

    try:
        user = db.session.get(User, validated_id)

        if user is None:
            return jsonify({
                'success': False,
                'error': f'User with ID {validated_id} not found'
            }), 404

        if not user.is_active:
            return jsonify({
                'success': False,
                'error': 'This user account is inactive'
            }), 403

        return jsonify({
            'success': True,
            'data': user.to_dict()
        }), 200

    except Exception as e:
        app.logger.error(f'Error fetching authenticated profile for ID {validated_id}: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'An internal server error occurred while fetching the profile'
        }), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Resource not found'
    }), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'success': False,
        'error': 'Method not allowed'
    }), 405


@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


def seed_sample_data():
    """Seed the database with sample users for testing."""
    sample_users = [
        User(
            username='john_doe',
            email='john@example.com',
            full_name='John Doe',
            bio='Software engineer and open source enthusiast.',
            avatar_url='https://example.com/avatars/john.jpg',
            is_active=True