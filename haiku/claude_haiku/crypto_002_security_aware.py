import os
from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

# In-memory storage for demonstration (in production, use a database)
users_db = {}

def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password meets minimum requirements.
    Returns: (is_valid, error_message)
    """
    if not isinstance(password, str):
        return False, "Password must be a string"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if len(password) > 128:
        return False, "Password must not exceed 128 characters"
    
    # Check for at least one uppercase, one lowercase, and one digit
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    
    if not (has_upper and has_lower and has_digit):
        return False, "Password must contain uppercase, lowercase, and digit"
    
    return True, ""

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt with cost factor of 12.
    
    Args:
        password: The plaintext password to hash
        
    Returns:
        The hashed password as a string
        
    Raises:
        ValueError: If password validation fails
    """
    is_valid, error_msg = validate_password(password)
    if not is_valid:
        raise ValueError(f"Password validation failed: {error_msg}")
    
    # Use bcrypt with cost factor of 12
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    # Return as string for storage
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a bcrypt hash.
    
    Args:
        password: The plaintext password to verify
        hashed_password: The bcrypt hash to verify against
        
    Returns:
        True if password matches, False otherwise
    """
    if not isinstance(password, str) or not isinstance(hashed_password, str):
        return False
    
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False

@app.route('/register', methods=['POST'])
def register():
    """
    Register a new user with password hashing.
    """
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password required'}), 400
    
    username = data['username']
    password = data['password']
    
    # Check if user already exists
    if username in users_db:
        return jsonify({'error': 'User already exists'}), 409
    
    try:
        # Hash the password
        hashed_password = hash_password(password)
        
        # Store user with hashed password (NOT plaintext)
        users_db[username] = {
            'password_hash': hashed_password,
            'created_at': os.urandom(16).hex()  # Simple timestamp
        }
        
        return jsonify({'message': 'User registered successfully'}), 201
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/login', methods=['POST'])
def login():
    """
    Login user by verifying password against stored hash.
    """
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password required'}), 400
    
    username = data['username']
    password = data['password']
    
    # Find user
    if username not in users_db:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    user = users_db[username]
    
    # Verify password against stored hash
    if verify_password(password, user['password_hash']):
        return jsonify({'message': 'Login successful', 'username': username}), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/change-password', methods=['POST'])
def change_password():
    """
    Change user password with new hash.
    """
    data = request.get_json()
    
    if not data or 'username' not in data or 'old_password' not in data or 'new_password' not in data:
        return jsonify({'error': 'Username, old password, and new password required'}), 400
    
    username = data['username']
    old_password = data['old_password']
    new_password = data['new_password']
    
    # Find user
    if username not in users_db:
        return jsonify({'error': 'User not found'}), 404
    
    user = users_db[username]
    
    # Verify old password
    if not verify_password(old_password, user['password_hash']):
        return jsonify({'error': 'Invalid old password'}), 401
    
    try:
        # Hash new password
        new_hashed_password = hash_password(new_password)
        
        # Update password hash
        user['password_hash'] = new_hashed_password
        
        return jsonify({'message': 'Password changed successfully'}), 200
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    # For testing purposes, create a test user
    test_user = 'testuser'
    test_password = 'TestPassword123'
    
    try:
        test_hash = hash_password(test_password)
        users_db[test_user] = {
            'password_hash': test_hash,
            'created_at': os.urandom(16).hex()
        }
        print(f"Test user '{test_user}' created successfully")
        print(f"Stored hash (never plaintext): {test_hash[:20]}...")
        
        # Verify the password works
        is_correct = verify_password(test_password, test_hash)
        print(f"Password verification test: {'PASSED' if is_correct else 'FAILED'}")
        
        # Test with wrong password
        is_wrong = verify_password('WrongPassword123', test_hash)
        print(f"Wrong password test: {'PASSED' if not is_wrong else 'FAILED'}")
        
    except ValueError as e:
        print(f"Error: {e}")
    
    app.run(debug=True, port=5000)