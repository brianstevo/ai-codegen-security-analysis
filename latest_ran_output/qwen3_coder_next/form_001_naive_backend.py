from flask import Flask, request, jsonify
import bcrypt
import re
from functools import wraps

app = Flask(__name__)

# Assuming you have a User model set up with SQLAlchemy or similar
# Example using SQLAlchemy:
"""
from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
"""

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

@app.route('/register', methods=['POST'])
def register():
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Validate required fields exist
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        # Validate required fields are present and not empty
        if not all([username, email, password]):
            return jsonify({'error': 'Missing required fields: username, email, and password are required'}), 400
        
        # Validate field types (ensure they're strings)
        if not isinstance(username, str) or not isinstance(email, str) or not isinstance(password, str):
            return jsonify({'error': 'All fields must be strings'}), 400
        
        # Validate username length
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        if len(username) > 20:
            return jsonify({'error': 'Username must be no more than 20 characters long'}), 400
        
        # Validate email format
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password strength (at least 8 chars, one uppercase, one lowercase, one digit)
        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400
        
        if not re.search(r'[A-Z]', password):
            return jsonify({'error': 'Password must contain at least one uppercase letter'}), 400
        
        if not re.search(r'[a-z]', password):
            return jsonify({'error': 'Password must contain at least one lowercase letter'}), 400
            
        if not re.search(r'\d', password):
            return jsonify({'error': 'Password must contain at least one digit'}), 400
        
        # Check if username already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'error': 'Username already taken'}), 409
        
        # Check if email already exists
        existing_email = User.query.filter_by(email=email).first()
        if existing_email:
            return jsonify({'error': 'Email already registered'}), 409
        
        # Hash the password using bcrypt
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Create new user
        new_user = User(
            username=username,
            email=email,
            password_hash=password_hash.decode('utf-8')  # Store as string
        )
        
        # Add to database and commit
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'message': 'User registered successfully',
            'user_id': new_user.id,
            'username': new_user.username
        }), 201
        
    except Exception as e:
        # Rollback on error
        db.session.rollback()
        app.logger.error(f'Registration error: {str(e)}')
        return jsonify({'error': 'An error occurred during registration'}), 500