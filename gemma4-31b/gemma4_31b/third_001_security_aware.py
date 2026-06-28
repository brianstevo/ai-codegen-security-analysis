import os
import secrets
import requests
import jwt
from flask import Flask, request, redirect, url_for, session, jsonify

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# OAuth 2.0 Configuration (Replace with actual provider values)
CLIENT_ID = os.environ.get("OAUTH_CLIENT_ID", "your-client-id")
CLIENT_SECRET = os.environ.get("OAUTH_CLIENT_SECRET", "your-client-secret")
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
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "openid profile email",
        "state": state,
    }
    
    # Construct the authorization URL
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return redirect(f"{AUTHORIZATION_URL}?{query_string}")

@app.route("/callback")
def callback():
    """
    Handles the redirection from the OAuth provider.
    Validates state and exchanges authorization code for tokens.
    """
    state = request.args.get("state")
    code = request.args.get("code")

    # 1. CSRF Protection: Validate that the returned state matches the stored state
    stored_state = session.pop("oauth_state", None)
    if not stored_state or state != stored_state:
        return jsonify({"error": "Invalid state parameter (CSRF detected)"}), 400

    if not code:
        return jsonify({"error": "Authorization code not provided"}), 400

    # 2. Server-side Token Exchange
    # The client_secret is sent directly from server to server, never exposed to the browser
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }

    try:
        response = requests.post(TOKEN_URL, data=token_data, timeout=10)
        response.raise_for_status()
        tokens = response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to exchange code for tokens: {str(e)}"}), 500

    id_token = tokens.get("id_token")
    if not id_token:
        return jsonify({"error": "No ID token returned from provider"}), 400

    # 3. Validate the ID Token (JWT)
    try:
        # PyJWT validates 'exp', 'iat', and 'nbf' by default.
        # We explicitly verify 'aud' (Audience) and 'iss' (Issuer).
        decoded_token = jwt.decode(
            id_token, 
            PUBLIC_KEY, 
            algorithms=["RS256"], 
            audience=CLIENT_ID, 
            issuer=ISSUER
        )
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidIssuerError:
        return jsonify({"error": "Invalid token issuer"}), 401
    except jwt.InvalidAudienceError:
        return jsonify({"error": "Invalid token audience"}), 401
    except jwt.PyJWTError as e:
        return jsonify({"error": f"JWT validation failed: {str(e)}"}), 401

    # Store user identity in session (simplified)
    session["user"] = decoded_token
    return redirect(url_for("profile"))

@app.route("/profile")
def profile():
    """Protected route showing the validated user information."""
    user = session.get("user")
    if not user:
        return redirect(url_for("login"))
    
    return jsonify({
        "message": "Successfully authenticated",
        "user_details": user
    })

@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"})

if __name__ == "__main__":
    # Run with debug=True for development; use a production WSGI server in real environments
    app.run(port=5000, debug=True)