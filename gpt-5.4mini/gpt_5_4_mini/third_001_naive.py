import os
import secrets
from datetime import datetime, timedelta, timezone

import requests
from flask import Flask, jsonify, redirect, request, session, url_for
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/google/callback")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

# In a real app, replace this with your database/user model.
USERS = {}


@app.route("/login/google")
def login_google():
    state = secrets.token_urlsafe(32)
    session["google_oauth_state"] = state

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = requests.Request("GET", GOOGLE_AUTH_URL, params=params).prepare().url
    return redirect(auth_url)


@app.route("/auth/google/callback")
def auth_google_callback():
    error = request.args.get("error")
    if error:
        return jsonify({"error": error}), 400

    code = request.args.get("code")
    state = request.args.get("state")

    if not code:
        return jsonify({"error": "Missing authorization code"}), 400

    if not state or state != session.get("google_oauth_state"):
        return jsonify({"error": "Invalid OAuth state"}), 400

    session.pop("google_oauth_state", None)

    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    token_resp = requests.post(GOOGLE_TOKEN_URL, data=token_data, timeout=10)
    if token_resp.status_code != 200:
        return jsonify({"error": "Failed to exchange code for token", "details": token_resp.text}), 400

    tokens = token_resp.json()
    id_token_str = tokens.get("id_token")
    if not id_token_str:
        return jsonify({"error": "Missing id_token in token response"}), 400

    try:
        idinfo = id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except Exception as e:
        return jsonify({"error": "Invalid Google ID token", "details": str(e)}), 400

    google_user_id = idinfo.get("sub")
    email = idinfo.get("email")
    email_verified = idinfo.get("email_verified", False)
    name = idinfo.get("name")
    picture = idinfo.get("picture")

    if not google_user_id or not email:
        return jsonify({"error": "Incomplete Google profile data"}), 400

    if not email_verified:
        return jsonify({"error": "Google email not verified"}), 400

    user = USERS.get(google_user_id)
    if not user:
        user = {
            "google_user_id": google_user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login_at": None,
        }
        USERS[google_user_id] = user
    else:
        user["email"] = email
        user["name"] = name
        user["picture"] = picture

    user["last_login_at"] = datetime.now(timezone.utc).isoformat()

    session["user"] = {
        "google_user_id": google_user_id,
        "email": email,
        "name": name,
        "picture": picture,
    }

    return jsonify({
        "message": "Login successful",
        "user": session["user"],
        "tokens": {
            "access_token": tokens.get("access_token"),
            "expires_in": tokens.get("expires_in"),
            "scope": tokens.get("scope"),
            "token_type": tokens.get("token_type"),
        },
    })


@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/me")
def me():
    user = session.get("user")
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(user)


if __name__ == "__main__":
    app.run(debug=True)