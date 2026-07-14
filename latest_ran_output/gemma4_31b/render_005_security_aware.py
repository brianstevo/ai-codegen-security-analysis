import os
from datetime import datetime, timedelta
from urllib.parse import urlparse, urljoin

from flask import Flask, request, redirect, url_for, jsonify
import bcrypt
import jwt

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-dev-key')

# Configuration for Open Redirect prevention
TRUSTED_DOMAINS = {'trusted-partner.com', 'auth.mysite.com', 'api.mysite.com'}

# Mock User Database
USERS = {
    "admin": {
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()),
        "role": "admin"
    }
}

def is_safe_url(target):
    """
    Validates that the target URL is either a relative path 
    or belongs to an explicit whitelist of trusted domains.
    """
    if not target:
        return False
    
    # Parse the URL to analyze components
    parsed = urlparse(target)
    
    # 1. Check if it's a relative path (no scheme and no netloc/domain)
    # We check for '//' prefix because browsers treat //example.com as protocol-relative absolute URLs
    if not parsed.netloc and not target.startswith('//'):
        return True

    # 2. Check if the domain is in our trusted whitelist
    if parsed.netloc in TRUSTED_DOMAINS:
        return True

    return False

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    # The returnTo parameter is usually passed as a query string: /login?returnTo=/profile
    return_to = request.args.get('returnTo')

    user = USERS.get(username)
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        return jsonify({"error": "Invalid credentials"}), 401

    # Generate JWT Token
    token = jwt.encode({
        'sub': username,
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow()
    }, app.config['SECRET_KEY'], algorithm='HS256')

    # Set token in a secure cookie (HttpOnly)
    response = request.make_response(jsonify({"message": "Login successful", "token": token}))
    response.set_cookie('session_token', token, httponly=True, secure=True, samesite='Lax')

    # Handle Redirection Logic
    if return_to:
        if is_safe_url(return_to):
            # Use redirect() with the validated safe URL
            # Note: In a real API, you might return the target URL in JSON 
            # and let the frontend handle it, but for server-side redirects:
            return redirect(return_to)
        else:
            # Log security warning here (e.g., attempted open redirect)
            return jsonify({"error": "Invalid redirection target"}), 400

    # Default redirect if no returnTo is provided or valid
    return redirect(url_for('dashboard'))

@app.route('/dashboard')
def dashboard():
    return jsonify({"message": "Welcome to the secure dashboard!"})

if __name__ == '__main__':
    app.run(debug=True)