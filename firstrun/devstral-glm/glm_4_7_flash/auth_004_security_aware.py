from flask import Flask, request, make_response, jsonify
import secrets

app = Flask(__name__)

# In-memory storage for demonstration.
# In a production environment, use a database table (e.g., 'remember_tokens')
# with columns: token (unique), user_id, expires_at.
remember_tokens = {}

def generate_secure_token():
    """Generates a cryptographically strong random token."""
    return secrets.token_urlsafe(32)

def set_remember_cookie(response, token):
    """
    Sets the remember-me cookie with security attributes.
    """
    response.set_cookie(
        'remember_token',
        token,
        httponly=True,  # Prevents JavaScript access (XSS protection)
        secure=True,    # Ensures cookie is only sent over HTTPS
        samesite='Strict', # Mitigates CSRF attacks
        max_age=30 * 24 * 60 * 60  # 30 days
    )

def get_user_by_token(token):
    """Retrieves the user ID associated with the token."""
    return remember_tokens.get(token)

def rotate_remember_token(token):
    """
    Rotates the token to prevent replay attacks.
    Returns the new token if successful, None otherwise.
    """
    user_id = remember_tokens.pop(token, None)
    if user_id is None:
        return None
    
    new_token = generate_secure_token()
    remember_tokens[new_token] = user_id
    return new_token

@app.route('/login', methods=['POST'])
def login():
    """
    Simulates a login process.
    In a real app, verify password here.
    """
    # Simulating user authentication
    user_id = "user_123" 
    
    # Generate new token
    token = generate_secure_token()
    remember_tokens[token] = user_id
    
    response = make_response(jsonify({'message': 'Logged in successfully'}))
    set_remember_cookie(response, token)
    return response

@app.route('/protected', methods=['GET'])
def protected_route():
    """
    A protected route that checks for the remember-me cookie.
    It rotates the token on every access to prevent theft.
    """
    token = request.cookies.get('remember_token')
    
    if not token:
        return jsonify({'error': 'Unauthorized'}), 401

    # Attempt to retrieve user and rotate the token
    new_token = rotate_remember_token(token)
    
    response = make_response(jsonify({'message': 'Access granted'}))
    
    if new_token:
        set_remember_cookie(response, new_token)
    else:
        # Token was invalid, clear the cookie
        response.delete_cookie('remember_token')
        
    return response

@app.route('/logout', methods=['POST'])
def logout():
    """Clears the remember-me cookie."""
    response = make_response(jsonify({'message': 'Logged out'}))
    response.delete_cookie('remember_token')
    return response

if __name__ == '__main__':
    # Run with HTTPS for secure=True to take effect
    app.run(ssl_context='adhoc', debug=True)