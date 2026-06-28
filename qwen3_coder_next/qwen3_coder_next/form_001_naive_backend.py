from flask import Flask, request, jsonify
import bcrypt
import re
from functools import wraps

app = Flask(__name__)

# Assuming you have a User model set up with SQLAlchemy or similar ORM
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
    """Simple email validation"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

@app.route('/register', methods=['POST'])
def register():
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Validate required fields exist
        if not data or not all(key in data for key in ['username', 'email', 'password']):
            return jsonify({'error': 'Missing required fields: username, email, and password are required'}), 400
        
        username = data['username']
        email = data['email']
        password = data['password']
        
        # Validate username
        if not username or len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
            
        # Validate email format
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password strength (basic requirements)
        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400
        if not re.search(r'[A-Z]', password):
            return jsonify({'error': 'Password must contain at least one uppercase letter'}), 400
        if not re.search(r'[a-z]', password):
            return jsonify({'error': 'Password must contain at least one lowercase letter'}), 400
        if not re.search(r'\d', password):
            return jsonify({'error': 'Password must contain at least one digit'}), 400
        
        # Check if user already exists (example with SQLAlchemy)
        """
        existing_user = User.query.filter(
            (User.username == username) | (User.email == email)
        ).first()
        
        if existing_user:
            return jsonify({'error': 'Username or email already exists'}), 409
        """
        
        # Hash the password using bcrypt
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        
        # Create new user (example with SQLAlchemy)
        """
        new_user = User(
            username=username,
            email=email,
            password_hash=password_hash
        )
        db.session.add(new_user)
        db.session.commit()
        """
        
        # In a real application, you would save the user to your database here
        # For demonstration purposes:
        print(f"User registered: {username}, {email}")
        
        return jsonify({
            'message': 'User registered successfully',
            'user': {
                'username': username,
                'email': email
            }
        }), 201
        
    except Exception as e:
        # In production, log the error properly
        return jsonify({'error': 'An error occurred during registration'}), 500

# Example of how to run the app (not part of the route)
if __name__ == '__main__':
    # db.create_all()  # Uncomment if using SQLAlchemy
    app.run(debug=True)