import os
import json
import secrets
from urllib.parse import urlparse, urljoin

import requests
from flask import Flask, redirect, request, session, url_for, jsonify, abort
from requests_oauthlib import OAuth2Session
import jwt
from datetime import datetime, timedelta

# -------------------------------------------------
# Configuration (set these environment variables)
# -------------------------------------------------
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
OAUTH_REDIRECT_URI = os.getenv(
    "OAUTH_REDIRECT_URI",
    "http://localhost:5000/auth/google/callback"
)
# Google OpenID Connect discovery URL
GOOGLE_DISCOVERY_URL = (
    "https://accounts.google.com/.well-known/openid-configuration"
)

if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    raise RuntimeError("Google OAuth client ID/secret must be set in env vars.")

# -------------------------------------------------
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SESSION_KEY", secrets.token_urlsafe(32))
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

def get_google_provider_cfg():
    return requests.get(GOOGLE_DISCOVERY_URL).json()

def is_safe_url(target):
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return (
        test_url.scheme in ("http", "https") and
        ref_url.netloc == test_url.netloc
    )

# -------------------------------------------------
# Login route – redirects user to Google consent screen
# -------------------------------------------------
@app.route("/login/google")
def login_google():
    google_cfg = get_google_provider_cfg()
    authorization_endpoint = google_cfg["authorization_endpoint"]

    # Generate a random state token and store it in session for CSRF protection
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state

    oauth2_session = OAuth2Session(
        client_id=GOOGLE_CLIENT_ID,
        redirect_uri=OAUTH_REDIRECT_URI,
        scope=["openid", "email", "profile"],
        state=state,
    )
    authorization_url, _ = oauth2_session.authorization_url(
        authorization_endpoint,
        access_type="offline",
        prompt="consent"
    )
    return redirect(authorization_url)

# -------------------------------------------------
# Callback route – handles Google's response
# -------------------------------------------------
@app.route("/auth/google/callback")
def auth_google_callback():
    # Verify state to protect against CSRF
    stored_state = session.pop("oauth_state", None)
    incoming_state = request.args.get("state")
    if not stored_state or stored_state != incoming_state:
        abort(400, description="Invalid OAuth state.")

    google_cfg = get_google_provider_cfg()
    token_endpoint = google_cfg["token_endpoint"]
    userinfo_endpoint = google_cfg["userinfo_endpoint"]

    oauth2_session = OAuth2Session(
        client_id=GOOGLE_CLIENT_ID,
        redirect_uri=OAUTH_REDIRECT_URI,
        state=incoming_state
    )
    try:
        token = oauth2_session.fetch_token(
            token_url=token_endpoint,
            client_secret=GOOGLE_CLIENT_SECRET,
            authorization_response=request.url,
        )
    except Exception as e:
        abort(400, description=f"Token exchange failed: {e}")

    # Use the token to fetch user info
    resp = oauth2_session.get(userinfo_endpoint)
    if resp.status_code != 200:
        abort(400, description="Failed to obtain user information from Google.")
    user_info = resp.json()

    # Basic validation of the ID token (optional but recommended)
    id_token = token.get("id_token")
    if not id_token:
        abort(400, description="No ID token returned by Google.")

    try:
        decoded_id = jwt.decode(
            id_token,
            options={"verify_signature": False},  # Skip signature verification for demo
            algorithms=["RS256"]
        )
    except Exception as e:
        abort(400, description=f"Invalid ID token: {e}")

    if not user_info.get("email_verified"):
        abort(400, description="Google account email not verified.")

    # Create our own JWT for the session (you could also set a Flask session)
    payload = {
        "sub": user_info["sub"],
        "email": user_info["email"],
        "name": user_info.get("name"),
        "picture": user_info.get("picture"),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=2),
    }
    app_jwt = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")

    # Return token in JSON (or set as HttpOnly cookie)
    response = jsonify({"access_token": app_jwt})
    response.set_cookie(
        "session_token",
        app_jwt,
        httponly=True,
        samesite="Lax",
        secure=False  # Set True when using HTTPS
    )
    return response

# -------------------------------------------------
# Protected endpoint example
# -------------------------------------------------
@app.route("/profile")
def profile():
    token = request.cookies.get("session_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        abort(401, description="Missing authentication token.")
    try:
        data = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        abort(401, description="Token expired.")
    except jwt.InvalidTokenError:
        abort(401, description="Invalid token.")

    return jsonify({
        "message": "Authenticated user profile",
        "user": {
            "id": data["sub"],
            "email": data["email"],
            "name": data.get("name"),
            "picture": data.get("picture")
        }
    })

# -------------------------------------------------
if __name__ == "__main__":
    # For development only; use a proper WSGI server in production
    app.run(host="0.0.0.0", port=5000, debug=True)