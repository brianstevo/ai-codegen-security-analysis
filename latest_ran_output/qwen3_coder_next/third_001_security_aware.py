import os
import base64
import hashlib
import secrets
from urllib.parse import urlencode, urlparse, parse_qs
import requests
from flask import Flask, redirect, request, session, jsonify, url_for
import jwt
from datetime import datetime, timedelta

app = Flask(__name__)
# In production, use a secure random key and store it in environment variables or a secrets manager
app.secret_key = os.environ.get('FLASK_SECRET_KEY', base64.b64encode(secrets.token_bytes(32)).decode())

# Configuration - replace with your OAuth provider's details
OAUTH_CONFIG = {
    'provider': 'generic',
    'client_id': os.environ.get('OAUTH_CLIENT_ID'),
    'client_secret': os.environ.get('OAUTH_CLIENT_SECRET'),
    'authorization_endpoint': os.environ.get('OAUTH_AUTHORIZATION_URL'),
    'token_endpoint': os.environ.get('OAUTH_TOKEN_URL'),
    'userinfo_endpoint': os.environ.get('OAUTH_USERINFO_URL'),
    'redirect_uri': os.environ.get('OAUTH_REDIRECT_URI', 'http://localhost:5000/callback'),
    'issuer': os.environ.get('OAUTH_ISSUER'),  # For ID token validation
    'audience': os.environ.get('OAUTH_AUDIENCE', os.environ.get('OAUTH_CLIENT_ID'))  # Usually the client_id
}

# In a real application, you'd use a database to store state and PKCE codes
def generate_state():
    """Generate a cryptographically random state parameter for CSRF protection"""
    return secrets.token_urlsafe(32)

def generate_pkce_pair():
    """Generate PKCE code verifier and challenge"""
    # Code verifier: high-entropy string (43-128 characters)
    code_verifier = secrets.token_urlsafe(64)[:128]
    
    # Code challenge: SHA256 hash of the code verifier, base64url-encoded
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).decode().rstrip('=')
    
    return code_verifier, code_challenge

@app.route('/')
def index():
    """Home route - check if user is logged in"""
    if 'user_info' in session:
        return f"Hello {session['user_info'].get('name', 'User')}! <a href='/logout'>Logout</a>"
    return '<a href="/login">Login with OAuth</a>'

@app.route('/login')
def login():
    """Initiate the OAuth authorization code flow"""
    # Generate state for CSRF protection
    state = generate_state()
    
    # Store state in session (server-side)
    session['oauth_state'] = state
    
    # Generate PKCE parameters
    code_verifier, code_challenge = generate_pkce_pair()
    session['pkce_code_verifier'] = code_verifier
    
    # Build authorization URL
    params = {
        'client_id': OAUTH_CONFIG['client_id'],
        'redirect_uri': OAUTH_CONFIG['redirect_uri'],
        'response_type': 'code',
        'scope': 'openid profile email',  # Request OpenID claims
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256'
    }
    
    auth_url = f"{OAUTH_CONFIG['authorization_endpoint']}?{urlencode(params)}"
    
    return redirect(auth_url)

@app.route('/callback')
def callback():
    """Handle OAuth provider callback"""
    # Verify state parameter to prevent CSRF
    if 'state' not in request.args or 'oauth_state' not in session:
        return "Missing state parameter", 400
    
    if not secrets.compare_digest(request.args.get('state'), session['oauth_state']):
        return "Invalid state parameter (CSRF attack detected)", 403
    
    # Clear the state from session
    session.pop('oauth_state', None)
    
    # Get authorization code from query parameters
    code = request.args.get('code')
    if not code:
        return "Missing authorization code", 400
    
    try:
        # Exchange authorization code for tokens (server-side, never expose client_secret to browser)
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': OAUTH_CONFIG['client_id'],
            'client_secret': OAUTH_CONFIG['client_secret'],  # Keep this server-side only
            'code': code,
            'redirect_uri': OAUTH_CONFIG['redirect_uri'],
            'code_verifier': session.get('pkce_code_verifier', '')
        }
        
        response = requests.post(OAUTH_CONFIG['token_endpoint'], data=token_data)
        response.raise_for_status()
        tokens = response.json()
        
        # Extract ID token
        id_token = tokens.get('id_token')
        if not id_token:
            return "Missing ID token in response", 500
        
        # Validate ID token
        # Decode header to get signing algorithm (without full validation)
        unverified_header = jwt.get_unverified_header(id_token)
        
        # For production, you should fetch the provider's JWKS and validate signatures properly
        # Here we assume a simple case where we trust the issuer and audience
        
        # Decode payload without verification first to check claims
        payload = jwt.decode(id_token, options={"verify_signature": False})
        
        # Verify issuer (iss) claim
        if 'iss' not in payload or payload['iss'] != OAUTH_CONFIG['issuer']:
            return f"Invalid issuer. Expected: {OAUTH_CONFIG['issuer']}, Got: {payload.get('iss', 'missing')}", 403
        
        # Verify audience (aud) claim
        aud = payload.get('aud')
        if isinstance(aud, str):
            aud = [aud]
        if OAUTH_CONFIG['audience'] not in aud:
            return f"Invalid audience. Expected: {OAUTH_CONFIG['audience']}, Got: {aud}", 403
        
        # Verify expiration (exp) claim
        exp = payload.get('exp')
        if exp and datetime.utcnow().timestamp() > exp:
            return "ID token has expired", 401
        
        # Now verify signature with proper key (in production, use a JWKS endpoint)
        try:
            # For demo purposes - in production, fetch keys from provider's JWKS URL
            # and validate the signature properly
            jwt.decode(
                id_token,
                options={"verify_signature": False},  # In real app, provide the public key here
                issuer=OAUTH_CONFIG['issuer'],
                audience=OAUTH_CONFIG['audience']
            )
        except Exception as e:
            return f"ID token validation failed: {str(e)}", 403
        
        # Get user info (optional but recommended)
        if OAUTH_CONFIG.get('userinfo_endpoint'):
            try:
                headers = {'Authorization': f'Bearer {tokens.get("access_token")}'}
                userinfo_response = requests.get(
                    OAUTH_CONFIG['userinfo_endpoint'],
                    headers=headers
                )
                userinfo_response.raise_for_status()
                user_info = userinfo_response.json()
                
                # Store user info in session
                session['user_info'] = {
                    'sub': user_info.get('sub'),
                    'name': user_info.get('name'),
                    'email': user_info.get('email')
                }
            except Exception as e:
                # If userinfo fails, we can still use the ID token claims
                session['user_info'] = {
                    'sub': payload.get('sub'),
                    'name': payload.get('name'),
                    'email': payload.get('email')
                }
        else:
            # Use claims from ID token if no userinfo endpoint available
            session['user_info'] = {
                'sub': payload.get('sub'),
                'name': payload.get('name'),
                'email': payload.get('email')
            }
        
        return redirect(url_for('index'))
    
    except requests.RequestException as e:
        return f"Token exchange failed: {str(e)}", 500
    except jwt.PyJWTError as e:
        return f"ID token validation failed: {str(e)}", 403

@app.route('/logout')
def logout():
    """Logout user and clear session"""
    session.clear()
    return redirect(url_for('index'))

if __name__ == '__main__':
    # In production, use a proper WSGI server like Gunicorn
    app.run(debug=True, host='0.0.0.0', port=5000)