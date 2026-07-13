import os
import secrets
import hashlib
import base64
from urllib.parse import urlencode, urlparse, parse_qs
import requests
import jwt
from flask import Flask, redirect, request, session, jsonify, url_for
from datetime import datetime, timedelta

app = Flask(__name__)
# In production, use a secure random key and store it in environment variables or secrets manager
app.secret_key = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))

# Configuration - replace with your OAuth provider's details
OAUTH_CONFIG = {
    'authorization_endpoint': 'https://provider.example.com/oauth/authorize',
    'token_endpoint': 'https://provider.example.com/oauth/token',
    'jwks_uri': 'https://provider.example.com/.well-known/jwks.json',
    'client_id': os.environ.get('OAUTH_CLIENT_ID', 'your-client-id'),
    'client_secret': os.environ.get('OAUTH_CLIENT_SECRET', 'your-client-secret'),
    'redirect_uri': os.environ.get('REDIRECT_URI', 'http://localhost:5000/callback'),
    'issuer': 'https://provider.example.com/',  # Expected issuer (iss) claim
    'audience': os.environ.get('OAUTH_CLIENT_ID', 'your-client-id'),  # Expected audience (aud) claim
}

def generate_pkce_pair():
    """Generate PKCE code verifier and challenge"""
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).decode().rstrip('=')
    return code_verifier, code_challenge

def validate_state(state):
    """Validate state parameter to prevent CSRF"""
    stored_state = session.get('oauth_state')
    if not stored_state or not secrets.compare_digest(stored_state, state):
        return False
    # Clear the state after validation
    session.pop('oauth_state', None)
    return True

def validate_id_token(id_token, nonce=None):
    """Validate JWT id_token"""
    try:
        # Fetch JWKS from provider
        jwks_response = requests.get(OAUTH_CONFIG['jwks_uri'])
        jwks_response.raise_for_status()
        jwks = jwks_response.json()
        
        # Decode header to get key ID (kid)
        unverified_header = jwt.get_unverified_header(id_token)
        kid = unverified_header.get('kid')
        if not kid:
            raise ValueError("Missing 'kid' in token header")
            
        # Find matching key
        rsa_key = None
        for key in jwks['keys']:
            if key['kid'] == kid:
                rsa_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break
                
        if not rsa_key:
            raise ValueError(f"Unable to find matching key for kid: {kid}")
        
        # Decode and validate token
        payload = jwt.decode(
            id_token,
            rsa_key,
            algorithms=['RS256'],
            audience=OAUTH_CONFIG['audience'],
            issuer=OAUTH_CONFIG['issuer'],
            options={"verify_exp": True, "verify_nbf": True}
        )
        
        # Validate nonce if provided
        if nonce and payload.get('nonce') != nonce:
            raise ValueError("Invalid nonce in ID token")
            
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("ID token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid ID token: {str(e)}")

@app.route('/')
def index():
    """Home route"""
    user = session.get('user')
    if user:
        return f"<h1>Welcome, {user.get('name', 'User')}!</h1><p>Email: {user.get('email')}</p><a href='/logout'>Logout</a>"
    return '<h1>OAuth 2.0 Authorization Code Flow Demo</h1><a href="/login">Login with OAuth Provider</a>'

@app.route('/login')
def login():
    """Initiate OAuth flow"""
    # Generate cryptographically random state and nonce
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    
    # Store state in session for validation later
    session['oauth_state'] = state
    session['oauth_nonce'] = nonce
    
    # Generate PKCE pair
    code_verifier, code_challenge = generate_pkce_pair()
    session['code_verifier'] = code_verifier
    
    # Build authorization URL
    params = {
        'client_id': OAUTH_CONFIG['client_id'],
        'redirect_uri': OAUTH_CONFIG['redirect_uri'],
        'response_type': 'code',
        'scope': 'openid profile email',
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256'
    }
    
    auth_url = f"{OAUTH_CONFIG['authorization_endpoint']}?{urlencode(params)}"
    return redirect(auth_url)

@app.route('/callback')
def callback():
    """Handle OAuth provider callback"""
    # Get authorization code and state from query parameters
    code = request.args.get('code')
    state = request.args.get('state')
    
    # Validate state parameter to prevent CSRF attacks
    if not validate_state(state):
        return jsonify({'error': 'Invalid or missing state parameter'}), 403
    
    try:
        # Exchange authorization code for tokens (server-side)
        token_data = {
            'client_id': OAUTH_CONFIG['client_id'],
            'client_secret': OAUTH_CONFIG['client_secret'],  # Never expose to browser
            'code': code,
            'redirect_uri': OAUTH_CONFIG['redirect_uri'],
            'grant_type': 'authorization_code',
            'code_verifier': session.get('code_verifier', '')
        }
        
        token_response = requests.post(OAUTH_CONFIG['token_endpoint'], data=token_data)
        token_response.raise_for_status()
        tokens = token_response.json()
        
        # Extract ID token
        id_token = tokens.get('id_token')
        if not id_token:
            return jsonify({'error': 'No ID token received'}), 500
        
        # Validate ID token and extract claims
        payload = validate_id_token(id_token, session.get('oauth_nonce'))
        
        # Store user info in session (in production, use server-side sessions or database)
        session['user'] = {
            'sub': payload['sub'],
            'name': payload.get('name'),
            'email': payload.get('email'),
            'iat': payload.get('iat'),
            'exp': payload.get('exp')
        }
        
        # Clear PKCE and nonce from session
        session.pop('code_verifier', None)
        session.pop('oauth_nonce', None)
        
        return redirect(url_for('index'))
    except requests.RequestException as e:
        app.logger.error(f"Token request failed: {str(e)}")
        return jsonify({'error': 'Failed to exchange authorization code for tokens'}), 500
    except ValueError as e:
        app.logger.error(f"ID token validation error: {str(e)}")
        return jsonify({'error': f'Invalid ID token: {str(e)}'}), 403

@app.route('/logout')
def logout():
    """Logout user"""
    session.pop('user', None)
    return redirect(url_for('index'))

if __name__ == '__main__':
    # In production, use a proper WSGI server like Gunicorn
    app.run(debug=True, port=5000)