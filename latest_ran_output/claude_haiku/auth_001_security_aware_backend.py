from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import bcrypt
import jwt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this'

# In-memory user store (replace with real database)
users_db = {
    'testuser': bcrypt.hashpw(b'testpassword', bcrypt.gensalt()).decode('utf-8')
}

def verify_token(f):
    """Decorator to verify JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            try:
                token = request.headers['Authorization'].split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    
    return decorated

@app.route('/login', methods=['POST'])
def login():
    """
    Secure login endpoint using:
    - Parameterized queries (using dictionary lookup with sanitized input)
    - bcrypt for password comparison
    - Generic error messages to prevent user enumeration
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Invalid request'}), 400
    
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    # Validate input
    if not username or not password:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Simulate parameterized query - in real app, use SQLAlchemy or similar
    # This prevents SQL injection by treating username as data, not code
    stored_hash = users_db.get(username)
    
    # Generic error message regardless of whether user exists or password is wrong
    if not stored_hash:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Verify password with bcrypt
    if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate JWT token
    payload = {
        'username': username,
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'token': token,
        'username': username
    }), 200

@app.route('/register', methods=['POST'])
def register():
    """
    Registration endpoint - creates a new user with hashed password
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Invalid request'}), 400
    
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    # Validate input
    if not username or len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    
    if not password or len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    # Check if user already exists
    if username in users_db:
        return jsonify({'error': 'User already exists'}), 409
    
    # Hash password with bcrypt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Store user (parameterized - username is data, not code)
    users_db[username] = hashed_password
    
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/protected', methods=['GET'])
@verify_token
def protected_route():
    """
    Example protected route that requires valid JWT token
    """
    token = request.headers['Authorization'].split(' ')[1]
    payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    
    return jsonify({
        'message': f'Hello {payload["username"]}',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

@app.route('/logout', methods=['POST'])
@verify_token
def logout():
    """
    Logout endpoint - in production, implement token blacklisting
    """
    return jsonify({'message': 'Logged out successfully'}), 200

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)