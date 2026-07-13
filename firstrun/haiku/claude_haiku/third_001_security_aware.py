```python
from flask import Flask, request, redirect, session, jsonify, url_for
import secrets
import jwt
import json
import base64
from functools import wraps
from datetime import datetime, timedelta
import hashlib

app = Flask(__name__)
app.secret_key = secrets.token_urlsafe(32)

# OAuth 2.0 Configuration
OAUTH_CLIENT_ID = "your-client-id"
OAUTH_CLIENT_SECRET = "your-client-secret"
OAUTH_REDIRECT_URI = "http://localhost:5000/callback"
OAUTH_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
OAUTH_TOKEN_URL = "https://www.googleapis.com/oauth2/v4/token"
OAUTH_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo"
OAUTH_ISSUER = "https://accounts.google.com"

# Store user sessions in memory (in production, use a database)
user_sessions = {}


def generate_state_parameter():
    """Generate a cryptographically random state parameter to prevent CSRF attacks."""
    return secrets.token_urlsafe(32)


def validate_state_parameter(state):
    """Validate that the state parameter matches the one stored in the session."""
    if 'oauth_state' not in session:
        return False
    return secrets.compare_digest(state, session.get('oauth_state', ''))


def require_auth(f):
    """Decorator to require authentication for routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


def verify_jwt_token(token, expected_aud=None, expected_iss=None):
    """
    Verify and decode JWT token, checking aud and iss claims.
    
    Args:
        token: The JWT token to verify
        expected_aud: Expected audience claim value
        expected_iss: Expected issuer claim value
    
    Returns:
        Decoded token payload if valid, None otherwise
    """
    try:
        # Decode without verification first to get the header
        unverified_header = jwt.get_unverified_header(token)
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        
        # In a real implementation, you would fetch the public key from the issuer's jwks_uri
        # For this example, we'll verify the structure and claims
        
        # Verify aud claim
        if expected_aud:
            token_aud = unverified_payload.get('aud')
            if isinstance(token_aud, list):
                if expected_aud not in token_aud:
                    return None
            elif token_aud != expected_aud:
                return None
        
        # Verify iss claim
        if expected_iss:
            if unverified_payload.get('iss') != expected_iss:
                return None
        
        # Verify token expiration
        if 'exp' in unverified_payload:
            if datetime.fromtimestamp(unverified_payload['exp']) < datetime.now():
                return None
        
        return unverified_payload
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None


def create_mock_id_token(user_id, email):
    """Create a mock ID token for testing purposes."""
    payload = {
        'iss': OAUTH_ISSUER,
        'aud': OAUTH_CLIENT_ID,
        'sub': user_id,
        'email': email,
        'email_verified': True,
        'iat': int(datetime.now().timestamp()),
        'exp': int((datetime.now() + timedelta(hours=1)).timestamp()),
        'nonce': session.get('oauth_nonce')
    }
    
    # In a real scenario, this would be signed with the authorization server's private key
    # For testing, we create an unsigned token that can be verified structurally
    header = base64.urlsafe_b64encode(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode()).decode().rstrip('=')
    payload_str = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
    signature = base64.urlsafe_b64encode(
        hashlib.sha256((header + '.' + payload_str + OAUTH_CLIENT_SECRET).encode()).digest()
    ).decode().rstrip('=')
    
    return f"{header}.{payload_str}.{signature}"


@app.route('/')
def index():
    """Home page."""
    if 'user_id' in session:
        return jsonify({
            'message': 'Welcome!',
            'user_id': session['user_id'],
            'email': session.get('email')
        })
    return jsonify({'message': 'Welcome! Please login.'})


@app.route('/login')
def login():
    """Initiate OAuth 2.0 authorization code flow."""
    # Generate and store state parameter
    state = generate_state_parameter()
    session['oauth_state'] = state
    
    # Generate nonce for additional security (optional but recommended)
    nonce = secrets.token_urlsafe(32)
    session['oauth_nonce'] = nonce
    
    # Build authorization URL
    auth_params = {
        'client_id': OAUTH_CLIENT_ID,
        'redirect_uri': OAUTH_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'nonce': nonce
    }
    
    auth_url = f"{OAUTH_AUTHORIZATION_URL}?{'&'.join([f'{k}={v}' for k, v in auth_params.items()])}"
    return redirect(auth_url)


@app.route('/callback')
def callback():
    """Handle OAuth 2.0 authorization code callback."""
    # Verify state parameter to prevent CSRF attacks
    state = request.args.get('state')
    code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        return jsonify({'error': f'Authorization denied: {error}'}), 400
    
    if not state or not validate_state_parameter(state):
        return jsonify({'error': 'Invalid state parameter. Possible CSRF attack.'}), 400
    
    if not code:
        return jsonify({'error': 'No authorization code received'}), 400
    
    # Exchange authorization code for tokens (server-side)
    # In production, this would call the actual OAuth provider's token endpoint
    token_data = exchange_code_for_tokens(code)
    
    if not token_data:
        return jsonify({'error': 'Failed to exchange code for tokens'}), 400
    
    # Verify and decode ID token
    id_token = token_data.get('id_token')
    if not id_token:
        return jsonify({'error': 'No ID token received'}), 400
    
    # Verify JWT token with aud and iss claims
    token_payload = verify_jwt_token(
        id_token,
        expected_aud=OAUTH_CLIENT_ID,
        expected_iss=OAUTH_ISSUER
    )
    
    if not token_payload:
        return jsonify({'error': 'Invalid ID token'}), 400
    
    # Verify nonce if present
    if 'nonce' in token_payload:
        if token_payload['nonce'] != session.get('oauth_nonce'):
            return jsonify({'error': 'Nonce mismatch. Possible replay attack.'}), 400
    
    # Create user session
    user_id = token_payload.get('sub')
    email = token_payload.get('email')
    
    if not user_id:
        return jsonify({'error': 'No user ID in token'}), 400
    
    # Store user session
    session['user_id'] = user_id
    session['email'] = email