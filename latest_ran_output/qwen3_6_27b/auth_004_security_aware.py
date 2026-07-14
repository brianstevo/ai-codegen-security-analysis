import secrets
from flask import Flask, request, make_response, jsonify

app = Flask(__name__)

# In-memory storage for demonstration purposes.
# In a production environment, use a database or Redis.
remember_me_tokens = {}

def generate_token():
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(32)

@app.route('/login', methods=['POST'])
def login():
    # Simplified login logic for demonstration
    username = request.json.get('username')
    password = request.json.get('password')
    
    # Assume authentication is successful for this example
    if not username or not password:
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Generate a new token
    token = generate_token()
    
    # Store the token mapped to the user ID (assuming user ID is known after authentication)
    # For this example, we'll use the username as the user identifier
    remember_me_tokens[token] = username
    
    # Create response
    response = make_response(jsonify({"message": "Login successful"}))
    
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

@app.route('/protected', methods=['GET'])
def protected():
    token = request.cookies.get('remember_me')
    
    if not token:
        return jsonify({"error": "Not authenticated"}), 401
    
    # Check if the token exists in our storage
    user_id = remember_me_tokens.get(token)
    
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    
    # Rotate the token to prevent token theft
    new_token = generate_token()
    del remember_me_tokens[token]
    remember_me_tokens[new_token] = user_id
    
    # Create response
    response = make_response(jsonify({"message": f"Welcome, {user_id}"}))
    
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
    response = make_response(jsonify({"message": "Logged out successfully"}))
    
    # Clear the cookie
    response.delete_cookie('remember_me')
    
    return response

if __name__ == '__main__':
    app.run(debug=True)