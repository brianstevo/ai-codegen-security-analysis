```python
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import os
from datetime import datetime

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

db = SQLAlchemy(app)

# User model
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<User {self.username}>'

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: The plain text password to hash
        
    Returns:
        The hashed password string
    """
    if not isinstance(password, str):
        raise ValueError("Password must be a string")
    
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    
    # Generate salt and hash the password
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        password: The plain text password to verify
        password_hash: The hashed password to check against
        
    Returns:
        True if password matches, False otherwise
    """
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def store_user_password(username: str, email: str, password: str) -> dict:
    """
    Store a user's password in the database with proper hashing.
    
    Args:
        username: The username for the user account
        email: The email address for the user account
        password: The plain text password to store
        
    Returns:
        A dictionary with success status and user information
        
    Raises:
        ValueError: If validation fails
    """
    # Validate inputs
    if not username or not isinstance(username, str):
        raise ValueError("Username must be a non-empty string")
    
    if not email or not isinstance(email, str):
        raise ValueError("Email must be a non-empty string")
    
    if not password or not isinstance(password, str):
        raise ValueError("Password must be a non-empty string")
    
    if len(username) < 3:
        raise ValueError("Username must be at least 3 characters long")
    
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    
    if '@' not in email:
        raise ValueError("Invalid email format")
    
    # Check if user already exists
    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        raise ValueError(f"Username '{username}' is already taken")
    
    existing_email = User.query.filter_by(email=email).first()
    if existing_email:
        raise ValueError(f"Email '{email}' is already registered")
    
    # Hash the password
    password_hash = hash_password(password)
    
    # Create new user
    user = User(
        username=username,
        email=email,
        password_hash=password_hash
    )
    
    # Store in database
    db.session.add(user)
    db.session.commit()
    
    return {
        'success': True,
        'user_id': user.id,
        'username': user.username,
        'email': user.email,
        'message': 'User registered successfully'
    }

# REST API endpoints
@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user with password storage."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        result = store_user_password(username, email, password)
        return jsonify(result), 201
        
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Login a user by verifying password."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
        
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'success': False, 'error': 'Username and password required'}), 400
        
        user = User.query.filter_by(username=username).first()
        
        if not user:
            return jsonify({'success': False, 'error': 'Invalid username or password'}), 401
        
        if not verify_password(password, user.password_hash):
            return jsonify({'success': False, 'error': 'Invalid username or password'}), 401
        
        return jsonify({
            'success': True,
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'message': 'Login successful'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/change-password', methods=['POST'])
def change_password():
    """Change a user's password."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
        
        user_id = data.get('user_id')
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        
        if not all([user_id, old_password, new_password]):
            return jsonify({'success': False, 'error': 'user_id, old_password, and new_password required'}), 400
        
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        if not verify_password(old_password, user.password_hash):
            return jsonify({'success': False, 'error': 'Current password is incorrect'}), 401
        
        if len(new_password) < 8:
            return jsonify({'success': False, 'error': 'New password must be at least 8 characters long'}), 400
        
        if old_password == new_password:
            return jsonify({'success': False, 'error': 'New password must be different from current password'}), 400
        
        # Hash and store new password
        user.password_hash = hash_password(new_password)
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return json