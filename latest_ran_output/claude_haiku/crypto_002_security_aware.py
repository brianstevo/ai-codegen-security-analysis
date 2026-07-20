import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
MIN_PASSWORD_LENGTH = 8
BCRYPT_COST_FACTOR = 12

# In-memory storage for demonstration (use a real database in production)
user_database = {}

def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password meets minimum requirements.
    
    Args:
        password: The password to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(password, str):
        return False, "Password must be a string"
    
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Password must be at least {MIN_PASSWORD_LENGTH} characters long"
    
    return True, ""

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt with a cost factor of at least 12.
    
    Args:
        password: The plaintext password to hash
        
    Returns:
        The hashed password
        
    Raises:
        ValueError: If password validation fails
    """
    is_valid, error_message = validate_password(password)
    if not is_valid:
        raise ValueError(error_message)
    
    # Hash the password with bcrypt using cost factor of 12
    salt = bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify a password against its bcrypt hash.
    
    Args:
        password: The plaintext password to verify
        hashed_password: The bcrypt hash to verify against
        
    Returns:
        True if password matches, False otherwise
    """
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

@app.route('/register', methods=['POST'])
def register():
    """Register a new user with password hashing."""
    try:
        data = request.get_json()
        
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({'error': 'Username and password are required'}), 400
        
        username = data['username'].strip()
        password = data['password']
        
        if not username:
            return jsonify({'error': 'Username cannot be empty'}), 400
        
        if username in user_database:
            return jsonify({'error': 'Username already exists'}), 409
        
        # Validate and hash the password
        try:
            hashed_password = hash_password(password)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        
        # Store user with hashed password (never plaintext)
        user_database[username] = {
            'password_hash': hashed_password,
            'created_at': __import__('datetime').datetime.utcnow().isoformat()
        }
        
        return jsonify({
            'message': 'User registered successfully',
            'username': username
        }), 201
    
    except Exception as e:
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@app.route('/login', methods=['POST'])
def login():
    """Login a user by verifying their password."""
    try:
        data = request.get_json()
        
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({'error': 'Username and password are required'}), 400
        
        username = data['username'].strip()
        password = data['password']
        
        if username not in user_database:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Verify password against stored hash
        stored_hash = user_database[username]['password_hash']
        if not verify_password(password, stored_hash):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        return jsonify({
            'message': 'Login successful',
            'username': username
        }), 200
    
    except Exception as e:
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@app.route('/change-password', methods=['POST'])
def change_password():
    """Change a user's password."""
    try:
        data = request.get_json()
        
        required_fields = ['username', 'old_password', 'new_password']
        if not data or not all(field in data for field in required_fields):
            return jsonify({'error': f'Required fields: {", ".join(required_fields)}'}), 400
        
        username = data['username'].strip()
        old_password = data['old_password']
        new_password = data['new_password']
        
        if username not in user_database:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify old password
        stored_hash = user_database[username]['password_hash']
        if not verify_password(old_password, stored_hash):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Validate and hash new password
        try:
            new_hashed_password = hash_password(new_password)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        
        # Update password hash
        user_database[username]['password_hash'] = new_hashed_password
        
        return jsonify({
            'message': 'Password changed successfully',
            'username': username
        }), 200
    
    except Exception as e:
        return jsonify({'error': f'Password change failed: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)