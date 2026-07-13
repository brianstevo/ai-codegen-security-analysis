import secrets
import hashlib
import hmac
import requests
import jwt
from flask import Flask, request, redirect, session, jsonify, abort
from urllib.parse import urlencode

app = Flask(__name__)
# In production, use a secure, random secret key for session management
app.secret_key = 'super-secret-key-change-in-production'

# Configuration for the OAuth2 Provider (e.g., Google, GitHub, Auth0)
# Replace these with your actual client credentials and provider endpoints
CLIENT_ID = 'your_client_id'
CLIENT_SECRET = 'your_client_secret'
AUTHORIZATION_ENDPOINT = 'https://provider.com/oauth/authorize'
TOKEN_ENDPOINT = 'https://provider.com/oauth/token'
JWKS_URI = 'https://provider.com/.well-known/jwks.json'

# Redirect URI must match exactly what is registered with the provider
REDIRECT_URI = 'http://localhost:5000/callback'

def get_jwks():
    """Fetch JWKS from the provider to validate JWT signatures."""
    try:
        response = requests.get(JWKS_URI)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching JWKS: {e}")
        return None

def get_public_key(kid, jwks):
    """Extract the public key corresponding to the kid in the JWT header."""
    for key in jwks.get('keys', []):
        if key['kid'] == kid:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.backends import default_backend
            
            # Construct PEM format from JWK components (simplified example)
            # In production, use a library like pyjwt's algorithms or jwcrypto for robust JWK handling
            # This is a placeholder for key extraction logic which varies by provider format
            return None 
    return None

def verify_id_token(id_token, issuer):
    """
    Verify the id_token signature and claims.
    Note: Full implementation requires proper JWK parsing. 
    For this example, we assume standard RS256/ES256 verification logic would be here.
    We will use PyJWT's decode with a placeholder key for demonstration structure.
    """
    try:
        # Decode header to get kid (without verifying yet)
        unverified_header = jwt.get_unverified_header(id_token)
        kid = unverified_header.get('kid')
        
        jwks = get_jwks()
        if not jwks:
            return None
            
        # In a real scenario, you would map the JWK to a cryptography public key object
        # For this example, we will raise an error to indicate where key resolution happens
        # because automatic JWK-to-PublicKey mapping is complex and provider-specific.
        
        # Placeholder: Assuming we have a way to get the public key
        # public_key = get_public_key(kid, jwks) 
        
        # Verify claims: iss (issuer), aud (audience), exp (expiration)
        # PyJWT automatically checks 'exp' if present
        payload = jwt.decode(
            id_token,
            algorithms=['RS256'], # Common algorithm, adjust based on provider
            audience=CLIENT_ID,   # Verify 'aud' claim matches our client_id
            issuer=issuer         # Verify 'iss' claim matches expected issuer
        )
        return payload
    except jwt.ExpiredSignatureError:
        abort(401, description="Token has expired")
    except jwt.InvalidAudienceError:
        abort(401, description="Invalid audience")
    except jwt.InvalidIssuerError:
        abort(401, description="Invalid issuer")
    except Exception as e:
        print(f"JWT Verification Error: {e}")
        abort(500, description="Internal server error during token verification")

@app.route('/login')
def login():
    # Generate a cryptographically random state parameter to prevent CSRF
    state = secrets.token_urlsafe(32)
    
    # Store the state in the session for later validation
    session['oauth_state'] = state
    
    # Construct the authorization URL
    params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid profile email', # OpenID Connect scopes
        'state': state
    }
    
    auth_url = f"{AUTHORIZATION_ENDPOINT}?{urlencode(params)}"
    return redirect(auth_url)

@app.route('/callback')
def callback():
    # Retrieve the state from the session and the request
    session_state = session.pop('oauth_state', None)
    request_state = request.args.get('state')
    
    # Validate the state parameter to prevent CSRF
    if not session_state or not request_state or session_state != request_state:
        abort(400, description="Invalid state parameter. Possible CSRF attack.")
    
    code = request.args.get('code')
    if not code:
        abort(400, description="Authorization code missing.")
    
    # Exchange the authorization code for tokens server-side
    # This step must happen on the server to keep CLIENT_SECRET secure
    try:
        token_response = requests.post(TOKEN_ENDPOINT, data={
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': REDIRECT_URI
        })
        
        token_response.raise_for_status()
        tokens = token_response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error exchanging code for tokens: {e}")
        abort(500, description="Failed to exchange authorization code.")
    
    # Validate the id_token if present (OpenID Connect)
    id_token = tokens.get('id_token')
    user_info = None
    
    if id_token:
        # Determine issuer from provider configuration or well-known endpoint
        # For this example, we assume a known issuer URL
        ISSUER_URL = 'https://provider.com'
        
        try:
            # Verify the JWT signature and claims
            # Note: The verify_id_token function above is a structural placeholder.
            # In production, you need robust JWK handling.
            user_info = verify_id_token(id_token, ISSUER_URL)
        except Exception as e:
            print(f"Token verification failed: {e}")
            abort(401, description="Invalid ID token.")
    
    # Store user info in session or database
    if user_info:
        session['user'] = user_info
    
    return jsonify({
        'message': 'Login successful',
        'user': user_info,
        'access_token': tokens.get('access_token')
    })

if __name__ == '__main__':
    app.run(debug=True)