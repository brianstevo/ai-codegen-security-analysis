from flask import Flask, request, jsonify, session
import secrets

app = Flask(__name__)
# Set a secret key for session management - in production use environment variable
app.secret_key = secrets.token_hex(32)

@app.route('/login', methods=['POST'])
def login():
    # Get credentials from request (in practice, validate these properly)
    username = request.json.get('username')
    password = request.json.get('password')
    
    # Here you would normally verify the user's credentials against your database
    # For demonstration purposes, assuming a successful authentication
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Simulate user validation (replace with actual authentication logic)
    # In real application: user = User.query.filter_by(username=username).first()
    # Then verify password hash, etc.
    if username == "valid_user" and password == "valid_password":
        # Create a session for the user
        user_id = 123  # In practice, get this from your database after authentication
        
        # Store user ID in session (Flask sessions are signed cookies by default)
        session['user_id'] = user_id
        
        return jsonify({'message': 'Login successful', 'user_id': user_id}), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

# Example route that requires authentication
@app.route('/profile')
def profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    return jsonify({'message': f'Profile for user ID: {user_id}'}), 200