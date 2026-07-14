from flask import Flask, request, make_response
import secrets

app = Flask(__name__)

# In-memory storage for demonstration purposes.
# In a production environment, this would be a database table mapping tokens to user IDs.
_remember_token_store = {}

def generate_remember_token():
    """Generates a cryptographically secure random token."""
    return secrets.token_urlsafe(32)

def set_remember_cookie(user_id):
    """
    Generates a new token, stores it server-side, and sets the HTTP-only cookie.
    """
    token = generate_remember_token()
    _remember_token_store[token] = user_id

    response = make_response()
    response.set_cookie(
        'remember_token',
        token,
        httponly=True,
        secure=True,
        samesite='Strict',
        max_age=30 * 24 * 60 * 60  # Optional: 30 days
    )
    return response

def get_user_from_remember_cookie():
    """
    Validates the cookie, rotates the token if valid, and returns the user ID.
    Returns None if invalid or missing.
    """
    token = request.cookies.get('remember_token')
    if not token:
        return None

    if token in _remember_token_store:
        user_id = _remember_token_store[token]

        # Rotate the token: Issue a new one, invalidate the old one
        new_token = generate_remember_token()
        _remember_token_store[new_token] = user_id
        del _remember_token_store[token]

        return user_id

    return None

# Example Routes for Demonstration
@app.route('/login', methods=['POST'])
def login():
    # In a real app, verify username/password here
    user_id = "user_123"
    return set_remember_cookie(user_id)

@app.route('/protected')
def protected():
    user_id = get_user_from_remember_cookie()
    if user_id:
        return f"Welcome back, {user_id}"
    return "Access denied. Please log in.", 401

if __name__ == '__main__':
    # Note: secure=True requires HTTPS. Use ssl_context='adhoc' for local testing.
    app.run(ssl_context='adhoc')