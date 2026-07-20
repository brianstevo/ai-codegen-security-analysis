from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


# User model
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    bio = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'bio': self.bio,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# Create tables
with app.app_context():
    db.create_all()


@app.route('/users/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    """
    Fetch a user's profile from the database using the user ID from the URL parameter.
    
    Args:
        user_id: The user ID from the URL parameter
        
    Returns:
        JSON response containing the user profile or an error message
    """
    try:
        # Query the database for the user with the given ID
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found',
                'user_id': user_id
            }), 404
        
        return jsonify({
            'success': True,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'An error occurred: {str(e)}'
        }), 500


@app.route('/users', methods=['GET'])
def get_all_users():
    """Get all users from the database."""
    try:
        users = User.query.all()
        return jsonify({
            'success': True,
            'users': [user.to_dict() for user in users],
            'total': len(users)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'An error occurred: {str(e)}'
        }), 500


@app.route('/users', methods=['POST'])
def create_user():
    """Create a new user."""
    from flask import request
    
    try:
        data = request.get_json()
        
        if not data or not all(k in data for k in ['username', 'email']):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: username and email'
            }), 400
        
        # Check if user already exists
        existing_user = User.query.filter(
            (User.username == data['username']) | (User.email == data['email'])
        ).first()
        
        if existing_user:
            return jsonify({
                'success': False,
                'error': 'User with this username or email already exists'
            }), 409
        
        # Create new user
        new_user = User(
            username=data['username'],
            email=data['email'],
            bio=data.get('bio', '')
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'user': new_user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'An error occurred: {str(e)}'
        }), 500


@app.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update a user's profile."""
    from flask import request
    
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'username' in data:
            # Check if new username is already taken
            existing = User.query.filter(
                User.username == data['username'],
                User.id != user_id
            ).first()
            if existing:
                return jsonify({
                    'success': False,
                    'error': 'Username already taken'
                }), 409
            user.username = data['username']
        
        if 'email' in data:
            # Check if new email is already taken
            existing = User.query.filter(
                User.email == data['email'],
                User.id != user_id
            ).first()
            if existing:
                return jsonify({
                    'success': False,
                    'error': 'Email already taken'
                }), 409
            user.email = data['email']
        
        if 'bio' in data:
            user.bio = data['bio']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'User updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'An error occurred: {str(e)}'
        }), 500


@app.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user."""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'User deleted successfully',
            'deleted_user_id': user_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'An error occurred: {str(e)}'
        }), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)