import os
import secrets
import requests
import jwt
from flask import Flask, request, redirect, url_for, session, jsonify

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# OAuth 2.0 Configuration (Replace with actual provider values)
CLIENT_ID = os.environ.get("OAUTH_CLIENT_ID", "your_client_id")
CLIENT_SECRET = os.environ.get("OAUTH_CLIENT_SECRET", "your_client_secret")
REDIRECT_URI = "http://localhost:5000/callback"
AUTHORIZATION_URL = "https://oauth-provider.com/auth"
TOKEN_URL = "https://oauth-provider.com/token"
ISSUER = "https://oauth-provider.com"
# In a real scenario, you would fetch the public key from the provider's JWKS endpoint
PUBLIC_KEY = os.environ.get("OAUTH_PUBLIC_KEY", "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----")

@app.route("/login")
def login():
    """
    Initiates the OAuth 2.0 Authorization Code Flow.
    Generates a cryptographically random state to prevent CSRF.
    """
    # Generate a high-entropy random state parameter
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "scope": "openid profile email",
        "redirect_uri": REDIRECT_URI,
        "state": state,
    }
    
    # Construct the authorization URL
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return redirect(f"{AUTHORIZATION_URL}?{query_string}")

@app.route("/callback")
def callback():
    """
    Handles the redirection from the OAuth provider.
    Validates state and exchanges the authorization code for tokens server-side.
    """
    code = request.args.get("code")
    state = request.args.get("state")

    # 1. CSRF Protection: Validate that the returned state matches the stored state
    stored_state = session.pop("oauth_state", None)
    if not state or state != stored_state:
        return jsonify({"error": "Invalid state parameter (CSRF detected)"}), 400

    if not code:
        return jsonify({"error": "Authorization code missing"}), 400

    # 2. Server-to-Server Token Exchange
    # The client_secret is sent directly from our server to the provider, never exposed to the browser.
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }

    response = requests.post(TOKEN_URL, data=token_data)
    if response.status_code != 200:
        return jsonify({"error": "Failed to exchange code for tokens", "details": response.text}), 500

    tokens = response.json()
    id_token = tokens.get("id_token")
    access_token = tokens.get("access_token")

    if not id_token:
        return jsonify({"error": "ID token missing from provider response"}), 400

    # 3. Validate the ID Token (JWT)
    try:
        # PyJWT validates expiration (exp), not-before (nbf), and custom claims like aud and iss.
        decoded_token = jwt.decode(
            id_token,
            PUBLIC_KEY,
            algorithms=["RS256"],
            audience=CLIENT_ID,  # Verify 'aud' claim matches our Client ID
            issuer=ISSUER        # Verify 'iss' claim matches the expected provider issuer
        )
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "ID token has expired"}), 401
    except jwt.InvalidIssuerError:
        return jsonify({"error": "Invalid token issuer"}), 401
    except jwt.InvalidAudienceError:
        return jsonify({"error": "Invalid token audience"}), 401
    except jwt.PyJWTError as e:
        return jsonify({"error": f"Token validation failed: {str(e)}"}), 401

    # Store user identity in session or database
    session["user"] = decoded_token

    return jsonify({
        "message": "Authentication successful",
        "user": decoded_token,
        "access_token": access_token
    })

@app.route("/profile")
def profile():
    if "user" not in session:
        return redirect(url_for("login"))
    return jsonify(session["user"])

if __name__ == "__main__":
    # Run with debug=True for development; use a production WSGI server (gunicorn) in deployment.
    app.run(port=5000, debug=True)