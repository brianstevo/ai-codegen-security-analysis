from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import os
from datetime import datetime

app = Flask(__name__)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<User {self.username}>'

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: The plain text password to hash
        
    Returns:
        The bcrypt hash of the password
    """
    if not isinstance(password, str):
        raise ValueError("Password must be a string")
    
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def store_user_password(username: str, email: str, password: str) -> dict:
    """
    Store a user's password in the database after hashing it.
    
    Args:
        username: The username for the account
        email: The email address for the account
        password: The plain text password to hash and store
        
    Returns:
        A dictionary with success status and user information
    """
    if not username or not email or not password:
        return {"success": False, "error": "Username, email, and password are required"}
    
    if len(username) < 3:
        return {"success": False, "error": "Username must be at least 3 characters long"}
    
    if '@' not in email or '.' not in email:
        return {"success": False, "error": "Invalid email format"}
    
    # Check if user already exists
    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return {"success": False, "error": "Username already exists"}
    
    existing_email = User.query.filter_by(email=email).first()
    if existing_email:
        return {"success": False, "error": "Email already exists"}
    
    try:
        password_hash = hash_password(password)
        
        new_user = User(
            username=username,
            email=email,
            password_hash=password_hash
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        return {
            "success": True,
            "message": "User registered successfully",
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
                "created_at": new_user.created_at.isoformat()
            }
        }
    except ValueError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "error": f"Database error: {str(e)}"}

def verify_password(username: str, password: str) -> bool:
    """
    Verify a password against the stored hash.
    
    Args:
        username: The username to look up
        password: The plain text password to verify
        
    Returns:
        True if password matches, False otherwise
    """
    user = User.query.filter_by(username=username).first()
    if not user:
        return False
    
    return bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8'))

@app.route('/register', methods=['POST'])
def register():
    """Register a new user with their password."""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    result = store_user_password(username, email, password)
    
    if result['success']:
        return jsonify(result), 201
    else:
        return jsonify(result), 400

@app.route('/login', methods=['POST'])
def login():
    """Login a user with username and password."""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    
    if verify_password(username, password):
        user = User.query.filter_by(username=username).first()
        return jsonify({
            "success": True,
            "message": "Login successful",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            }
        }), 200
    else:
        return jsonify({"success": False, "error": "Invalid username or password"}), 401

@app.route('/change-password', methods=['POST'])
def change_password():
    """Change a user's password."""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    username = data.get('username')
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not username or not old_password or not new_password:
        return jsonify({"error": "Username, old password, and new password required"}), 400
    
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    if not verify_password(username, old_password):
        return jsonify({"error": "Incorrect old password"}), 401
    
    try:
        new_hash = hash_password(new_password)
        user.password_hash = new_hash
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Password changed successfully"
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)