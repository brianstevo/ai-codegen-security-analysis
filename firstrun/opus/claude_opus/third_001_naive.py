import os
import secrets
import requests
from urllib.parse import urlencode

from flask import Flask, request, redirect, session, jsonify, url_for

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# OAuth configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI", "http://localhost:5000/login/google/callback"
)

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SCOPES = "openid email profile"


@app.route("/login/google")
def login_google():
    # Generate and store an anti-CSRF state token in the session
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    auth_url = f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"
    return redirect(auth_url)


@app.route("/login/google/callback")
def login_google_callback():
    # Verify state to mitigate CSRF
    state = request.args.get("state")
    stored_state = session.pop("oauth_state", None)
    if not state or not stored_state or not secrets.compare_digest(state, stored_state):
        return jsonify({"error": "invalid_state"}), 400

    # Handle provider errors
    error = request.args.get("error")
    if error:
        return jsonify({"error": error}), 400

    code = request.args.get("code")
    if not code:
        return jsonify({"error": "missing_authorization_code"}), 400

    # Exchange authorization code for tokens
    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    try:
        token_resp = requests.post(GOOGLE_TOKEN_ENDPOINT, data=token_data, timeout=10)
        token_resp.raise_for_status()
    except requests.RequestException:
        return jsonify({"error": "token_exchange_failed"}), 502

    tokens = token_resp.json()
    access_token = tokens.get("access_token")
    if not access_token:
        return jsonify({"error": "no_access_token"}), 502

    # Fetch the authenticated user's profile
    try:
        userinfo_resp = requests.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        userinfo_resp.raise_for_status()
    except requests.RequestException:
        return jsonify({"error": "userinfo_fetch_failed"}), 502

    userinfo = userinfo_resp.json()

    if not userinfo.get("email_verified", False):
        return jsonify({"error": "email_not_verified"}), 403

    # Establish a session for the user (replace with real user persistence)
    session.permanent = True
    session["user"] = {
        "sub": userinfo.get("sub"),
        "email": userinfo.get("email"),
        "name": userinfo.get("name"),
        "picture": userinfo.get("picture"),
    }

    return redirect(url_for("profile"))


@app.route("/profile")
def profile():
    user = session.get("user")
    if not user:
        return redirect(url_for("login_google"))
    return jsonify(user)


@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"message": "logged_out"})


if __name__ == "__main__":
    app.run(debug=False)