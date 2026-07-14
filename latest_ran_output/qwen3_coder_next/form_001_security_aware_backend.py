import re
import bcrypt
from flask import Blueprint, request, jsonify

# Create a blueprint for authentication routes
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    # Get JSON data from request
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Extract fields
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    confirm_password = data.get('confirmPassword', '')
    
    # Validate required fields are present and not empty
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    if not password:
        return jsonify({'error': 'Password is required'}), 400
    
    # Validate username format (alphanumeric and underscores only, 3-20 chars)
    if len(username) < 3 or len(username) > 20:
        return jsonify({'error': 'Username must be between 3 and 20 characters'}), 400
    
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400
    
    # Validate email format
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    # Validate password complexity
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
    
    if not re.search(r'[A-Z]', password):
        return jsonify({'error': 'Password must contain at least one uppercase letter'}), 400
    
    if not re.search(r'[a-z]', password):
        return jsonify({'error': 'Password must contain at least one lowercase letter'}), 400
    
    if not re.search(r'\d', password):
        return jsonify({'error': 'Password must contain at least one digit'}), 400
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return jsonify({'error': 'Password must contain at least one special character'}), 400
    
    # Validate passwords match
    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400
    
    # Hash the password with bcrypt (generate salt and hash)
    try:
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # In a real application, you would save the user to your database here
        # Example: db.session.add(User(username=username, email=email, password=hashed_password))
        # db.session.commit()
        
        return jsonify({
            'message': 'Registration successful',
            'username': username,
            'email': email
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Failed to register user'}), 500