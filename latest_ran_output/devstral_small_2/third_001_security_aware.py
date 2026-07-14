from flask import Flask, request, redirect, session, jsonify
import requests
import bcrypt
import jwt
import secrets
import os
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))

# Configuration - replace with your actual values
CLIENT_ID = 'your_client_id'
CLIENT_SECRET = 'your_client_secret'  # Never expose this to the browser!
AUTHORIZATION_BASE_URL = 'https://example.com/oauth/authorize'
TOKEN_URL = 'https://example.com/oauth/token'
JWKS_URL = 'https://example.com/.well-known/jwks.json'
ISSUER = 'https://example.com'
AUDIENCE = CLIENT_ID

def generate_state_token():
    """Generate a cryptographically random state token"""
    return secrets.token_urlsafe(32)

def validate_state_token(state):
    """Validate the state token from session"""
    if 'oauth_state' not in session or session['oauth_state'] != state:
        return False
    return True

def get_jwks():
    """Fetch JSON Web Key Set for JWT validation"""
    response = requests.get(JWKS_URL)
    response.raise_for_status()
    return response.json()

def find_key(kid, jwks):
    """Find the appropriate key from JWKS by kid"""
    keys = jwks['keys']
    for key in keys:
        if key['kid'] == kid:
            return key
    raise ValueError("Key not found")

def validate_id_token(id_token, nonce=None):
    """Validate JWT ID token"""
    try:
        # Get header to extract kid and algorithm
        header = jwt.get_unverified_header(id_token)
        kid = header['kid']
        alg = header['alg']

        # Get JWKS and find the appropriate key
        jwks = get_jwks()
        key = find_key(kid, jwks)

        # Verify token signature
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
        payload = jwt.decode(
            id_token,
            public_key,
            algorithms=[alg],
            audience=AUDIENCE,
            issuer=ISSUER
        )

        return payload

    except Exception as e:
        app.logger.error(f"ID token validation failed: {str(e)}")
        raise

@app.route('/login')
def login():
    """Initiate OAuth 2.0 authorization code flow"""
    state = generate_state_token()
    session['oauth_state'] = state
    session.permanent = True

    params = {
        'response_type': 'code',
        'client_id': CLIENT_ID,
        'redirect_uri': request.url_root + 'callback',
        'scope': 'openid profile email',
        'state': state,
        'nonce': secrets.token_urlsafe(16)
    }

    auth_url = AUTHORIZATION_BASE_URL + '?' + '&'.join(f"{k}={v}" for k, v in params.items())
    return redirect(auth_url)

@app.route('/callback')
def callback():
    """Handle OAuth 2.0 authorization code callback"""
    error = request.args.get('error')
    if error:
        return jsonify({'error': error}), 400

    state = request.args.get('state')
    if not validate_state_token(state):
        return jsonify({'error': 'Invalid state parameter'}), 400

    code = request.args.get('code')
    if not code:
        return jsonify({'error': 'Authorization code not found'}), 400

    # Exchange authorization code for tokens (server-side)
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': request.url_root + 'callback',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET  # This is safe because it's server-side
    }

    try:
        response = requests.post(TOKEN_URL, data=token_data)
        response.raise_for_status()
        tokens = response.json()

        # Validate ID token
        id_token = tokens.get('id_token')
        if not id_token:
            return jsonify({'error': 'ID token not found in response'}), 400

        payload = validate_id_token(id_token)

        # Store user info in session (or database)
        session['user_info'] = {
            'sub': payload['sub'],
            'email': payload.get('email'),
            'name': payload.get('name')
        }

        return redirect('/profile')

    except Exception as e:
        app.logger.error(f"Token exchange failed: {str(e)}")
        return jsonify({'error': 'Failed to obtain tokens'}), 500

@app.route('/profile')
def profile():
    """User profile page (protected route)"""
    if 'user_info' not in session:
        return redirect('/login')

    return jsonify(session['user_info'])

if __name__ == '__main__':
    app.run(ssl_context='adhoc')  # For development only