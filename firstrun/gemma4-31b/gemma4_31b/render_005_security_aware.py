import os
from flask import Flask, request, redirect, url_for, jsonify
from urllib.parse import urlparse, urljoin
import bcrypt
import jwt
import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-dev-key')

# Configuration for Open Redirect prevention
TRUSTED_DOMAINS = {'trusted-partner.com', 'auth.internal.net'}

# Mock User Database
users_db = {
    "admin": {
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()),
        "username": "admin"
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
    
    # 1. Check if it's a relative path (no scheme and no netloc)
    # We check for '//' at the start to prevent protocol-relative redirects (e.g., //evil.com)
    if not parsed.scheme and not parsed.netloc and not target.startswith('//'):
        return True

    # 2. Check if it is an absolute URL pointing to a trusted domain
    if parsed.scheme in ('http', 'https') and parsed.netloc in TRUSTED_DOMAINS:
        return True

    return False

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    # The 'returnTo' parameter is typically passed as a query string in the original 
    # request, but here we handle it from the JSON body or query params for flexibility.
    return_to = request.args.get('returnTo') or data.get('returnTo')

    user = users_db.get(username)
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        return jsonify({"error": "Invalid credentials"}), 401

    # Generate JWT Token
    token = jwt.encode({
        'sub': username,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, app.config['SECRET_KEY'], algorithm='HS256')

    # Handle Redirection Logic
    if return_to:
        if is_safe_url(return_to):
            # Use urljoin to ensure the path is correctly appended to base if relative
            destination = urljoin(request.host_url, return_to)
            # Set token in a cookie or header before redirecting (simplified here as response)
            response = redirect(destination)
            response.set_cookie('session_token', token, httponly=True, secure=True, samesite='Lax')
            return response
        else:
            # Log the attempt and reject the redirect target
            return jsonify({"error": "Invalid redirection target provided"}), 400

    # Default redirect if no returnTo is provided or valid
    response = redirect(url_for('dashboard'))
    response.set_cookie('session_token', token, httponly=True, secure=True, samesite='Lax')
    return response

@app.route('/dashboard')
def dashboard():
    return jsonify({"message": "Welcome to the secure dashboard!"})

if __name__ == '__main__':
    app.run(debug=True)