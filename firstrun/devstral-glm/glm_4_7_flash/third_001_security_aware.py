import os
import secrets
import requests
import jwt
from flask import Flask, session, redirect, url_for, request, jsonify
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Required for session management

# Configuration (Replace with actual values from your OAuth provider)
CLIENT_ID = "your_client_id"
CLIENT_SECRET = "your_client_secret"
REDIRECT_URI = "http://localhost:5000/callback"
AUTHORIZATION_ENDPOINT = "https://provider.com/oauth/authorize"
TOKEN_ENDPOINT = "https://provider.com/oauth/token"
ISSUER = "https://provider.com"
JWKS_URI = f"{ISSUER}/.well-known/jwks.json"

# In-memory cache for JWKS keys to avoid repeated network requests
jwks_cache = {}

def get_jwks():
    """Fetches the JSON Web Key Set (JWKS) from the issuer."""
    if jwks_cache:
        return jwks_cache
    
    try:
        response = requests.get(JWKS_URI)
        response.raise_for_status()
        jwks_cache.update(response.json())
        return jwks_cache
    except requests.RequestException as e:
        print(f"Error fetching JWKS: {e}")
        return {}

def verify_id_token(id_token):
    """
    Validates the JWT id_token.
    Verifies signature, issuer (iss), and audience (aud).
    """
    try:
        # 1. Fetch JWKS to get the public key
        jwks = get_jwks()
        if not jwks:
            raise ValueError("Could not fetch JWKS")

        # 2. Extract the 'kid' (Key ID) from the token header
        header = jwt.get_unverified_header(id_token)
        kid = header.get('kid')
        
        if not kid:
            raise ValueError("Token header missing 'kid'")

        # 3. Find the matching key in the JWKS
        key = None
        for key_data in jwks['keys']:
            if key_data['kid'] == kid:
                # Convert JWK format to a PEM public key object
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
                key = public_key
                break

        if not key:
            raise ValueError("No matching key found in JWKS")

        # 4. Decode and verify the token
        payload = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=ISSUER
        )
        return payload

    except jwt.InvalidTokenError as e:
        print(f"JWT Validation Failed: {e}")
        return None

@app.route('/login')
def login():
    """
    Initiates the OAuth 2.0 Authorization Code flow.
    Generates a cryptographically random state parameter.
    """
    # Generate a cryptographically random state
    state = secrets.token_urlsafe(16)
    session['oauth_state'] = state

    params = {
        'response_type': 'code',
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'scope': 'openid profile email',
        'state': state
    }
    
    # Redirect the user to the authorization server
    return redirect(f"{AUTHORIZATION_ENDPOINT}?{requests.utils.urlencode(params)}")

@app.route('/callback')
def callback():
    """
    Handles the callback from the OAuth provider.
    Exchanges the authorization code for tokens and validates the ID token.
    """
    # 1. Validate State (CSRF Protection)
    if 'oauth_state' not in session:
        return "Error: State not found in session", 400
    
    incoming_state = request.args.get('state')
    if incoming_state != session['oauth_state']:
        return "Error: Invalid state parameter (CSRF detected)", 400

    code = request.args.get('code')
    if not code:
        return "Error: Authorization code not found", 400

    # 2. Exchange Code for Tokens (Server-side)
    # The client secret is sent here, never exposed to the browser
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }

    try:
        response = requests.post(TOKEN_ENDPOINT, data=token_data)
        response.raise_for_status()
        tokens = response.json()
    except requests.RequestException as e:
        return f"Error exchanging token: {e}", 500

    # 3. Validate ID Token
    id_token = tokens.get('id_token')
    if not id_token:
        return "Error: No ID token returned", 500

    payload = verify_id_token(id_token)
    if not payload:
        return "Error: ID token validation failed", 401

    # 4. Success
    return jsonify({
        "message": "Authentication successful",
        "user": payload
    })

if __name__ == '__main__':
    app.run(port=5000)