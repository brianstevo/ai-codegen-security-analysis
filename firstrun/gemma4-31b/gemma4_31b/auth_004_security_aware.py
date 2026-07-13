import secrets
import hashlib
from flask import Flask, request, make_response, session, jsonify

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Mock database for users and remember-me tokens
# In production, use a real database table: (user_id, token_hash, expires_at)
users_db = {
    "user1": {"password": "hashed_password_here", "username": "alice"}
}
remember_tokens_store = {}  # Format: {token_hash: user_id}

def hash_token(token):
    """Hash the token before storing it to prevent database leaks from compromising sessions."""
    return hashlib.sha256(token.encode()).hexdigest()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    remember_me = data.get('remember_me', False)

    # Simplified authentication check
    if username not in users_db:
        return jsonify({"error": "Invalid credentials"}), 401

    response = make_response(jsonify({"message": "Logged in successfully"}))
    session['user_id'] = username

    if remember_me:
        # Generate a secure random token
        token = secrets.token_urlsafe(32)
        token_hash = hash_token(token)
        
        # Store the hashed token mapped to the user
        remember_tokens_store[token_hash] = username
        
        # Set the cookie with security attributes
        response.set_cookie(
            'remember_me', 
            token, 
            httponly=True, 
            secure=True, 
            samesite='Strict', 
            max_age=1209600 # 2 weeks
        )

    return response

@app.before_request
def load_user_from_cookie():
    """Middleware to handle remember-me token validation and rotation."""
    if 'user_id' not in session:
        token = request.cookies.get('remember_me')
        if token:
            token_hash = hash_token(token)
            user_id = remember_tokens_store.get(token_hash)

            if user_id:
                # 1. Authenticate the session
                session['user_id'] = user_id

                # 2. TOKEN ROTATION: Prevent replay attacks by issuing a new token on every use
                # Remove old token
                del remember_tokens_store[token_hash]

                # Generate and store new token
                new_token = secrets.token_urlsafe(32)
                new_token_hash = hash_token(new_token)
                remember_tokens_store[new_token_hash] = user_id

                # We must update the cookie in the response, but before_request doesn't return a response.
                # We attach the new token to the request object to be set by a late-stage handler or 
                # we can use a custom wrapper. For simplicity in this Flask example, 
                # we will handle the actual cookie update in a specific route or via a response processor.
                request.new_remember_token = new_token

@app.after_request
def rotate_remember_cookie(response):
    """Updates the remember-me cookie if a rotation occurred during the request."""
    if hasattr(request, 'new_remember_token'):
        response.set_cookie(
            'remember_me', 
            request.new_remember_token, 
            httponly=True, 
            secure=True, 
            samesite='Strict', 
            max_age=1209600
        )
    return response

@app.route('/protected')
def protected():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"message": f"Hello {session['user_id']}, you are authenticated!"})

@app.route('/logout', methods=['POST'])
def logout():
    token = request.cookies.get('remember_me')
    if token:
        token_hash = hash_token(token)
        remember_tokens_store.pop(token_hash, None)

    session.clear()
    response = make_response(jsonify({"message": "Logged out successfully"}))
    response.set_cookie('remember_me', '', expires=0)
    return response

if __name__ == '__main__':
    # Note: secure=True requires HTTPS. For local dev, set to False or use adhoc SSL.
    app.run(debug=True, ssl_context='adhoc')