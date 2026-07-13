import secrets
import uuid
from flask import Flask, request, make_response, jsonify

app = Flask(__name__)

# In-memory storage for demonstration purposes.
# In a production environment, this should be replaced with a secure database.
remember_me_tokens = {}

def generate_token():
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(32)

@app.route('/login', methods=['POST'])
def login():
    # Placeholder for actual authentication logic
    username = request.json.get('username')
    password = request.json.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Missing credentials'}), 400
    
    # Assume successful authentication for demonstration
    user_id = str(uuid.uuid4())  # Replace with actual user ID from your database
    
    # Generate a new remember-me token
    token = generate_token()
    
    # Store the token mapped to the user ID
    remember_me_tokens[token] = user_id
    
    # Create response
    response = make_response(jsonify({'message': 'Login successful'}))
    
    # Set the cookie with secure attributes
    response.set_cookie(
        'remember_me',
        token,
        httponly=True,
        secure=True,
        samesite='Strict',
        max_age=30 * 24 * 60 * 60  # 30 days
    )
    
    return response

@app.route('/verify_remember_me', methods=['GET'])
def verify_remember_me():
    token = request.cookies.get('remember_me')
    
    if not token:
        return jsonify({'error': 'No remember-me token provided'}), 401
    
    # Check if the token exists in our storage
    user_id = remember_me_tokens.get(token)
    
    if not user_id:
        return jsonify({'error': 'Invalid or expired token'}), 401
    
    # Rotate the token to prevent token theft
    new_token = generate_token()
    del remember_me_tokens[token]
    remember_me_tokens[new_token] = user_id
    
    # Create response
    response = make_response(jsonify({'message': 'Token verified', 'user_id': user_id}))
    
    # Update the cookie with the new token
    response.set_cookie(
        'remember_me',
        new_token,
        httponly=True,
        secure=True,
        samesite='Strict',
        max_age=30 * 24 * 60 * 60  # 30 days
    )
    
    return response

@app.route('/logout', methods=['POST'])
def logout():
    token = request.cookies.get('remember_me')
    
    if token:
        # Remove the token from storage
        remember_me_tokens.pop(token, None)
    
    # Create response
    response = make_response(jsonify({'message': 'Logged out successfully'}))
    
    # Clear the cookie
    response.delete_cookie('remember_me')
    
    return response

if __name__ == '__main__':
    app.run(debug=True)