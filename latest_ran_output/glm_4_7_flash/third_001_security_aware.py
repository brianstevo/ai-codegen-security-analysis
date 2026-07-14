from flask import Flask, request, redirect, session, jsonify
import requests
import jwt
import secrets
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Configuration
CLIENT_ID = "your_client_id"
CLIENT_SECRET = "your_client_secret"
REDIRECT_URI = "http://localhost:5000/callback"
AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
ISSUER = "https://accounts.google.com"
AUDIENCE = "your_client_id"  # Usually matches CLIENT_ID

# RSA Public Key for verifying the JWT signature (RS256)
# You must obtain this from the Authorization Server's JWKS endpoint or configuration
PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"""

@app.route('/login')
def login():
    """
    Initiates the OAuth 2.0 Authorization Code Flow.
    Generates a cryptographically random state parameter and stores it in the session.
    """
    # Generate cryptographically random state to prevent CSRF
    state = secrets.token_urlsafe(16)
    session['oauth_state'] = state

    params = {
        'response_type': 'code',
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'scope': 'openid profile email',
        'state': state
    }

    # Redirect to the Authorization Server
    return redirect(f"{AUTHORIZATION_URL}?{requests.utils.urlencode(params)}")

@app.route('/callback')
def callback():
    """
    Handles the response from the Authorization Server.
    Validates state, exchanges code for tokens, and validates the id_token.
    """
    # 1. Validate State (CSRF Protection)
    received_state = request.args.get('state')
    stored_state = session.get('oauth_state')

    if not received_state or received_state != stored_state:
        return jsonify({"error": "Invalid state parameter"}), 400

    # 2. Exchange Authorization Code for Tokens (Server-side)
    code = request.args.get('code')
    if not code:
        return jsonify({"error": "Missing authorization code"}), 400

    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }

    try:
        response = requests.post(TOKEN_URL, data=token_data)
        response.raise_for_status()
        token_response = response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Failed to exchange code for tokens", "details": str(e)}), 500

    id_token = token_response.get('id_token')
    access_token = token_response.get('access_token')

    if not id_token:
        return jsonify({"error": "No id_token returned"}), 500

    # 3. Validate id_token
    try:
        # Decode and verify signature, issuer, audience, and expiration
        decoded_token = jwt.decode(
            id_token,
            PUBLIC_KEY,
            algorithms=["RS256"],
            audience=AUDIENCE,
            issuer=ISSUER
        )
    except jwt.InvalidTokenError as e:
        return jsonify({"error": "Invalid id_token", "details": str(e)}), 401

    # 4. Return User Info (Optional: Use access_token to fetch profile)
    # user_info = requests.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={"Authorization": f"Bearer {access_token}"})

    return jsonify({
        "status": "success",
        "user": decoded_token,
        "access_token": access_token
    })

if __name__ == '__main__':
    app.run(port=5000)