import os
import secrets
import functools

import requests
from flask import Flask, redirect, request, session, url_for, jsonify, abort
from urllib.parse import urlencode

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# --- Configuration ---
GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI", "http://localhost:5000/login/google/callback"
)

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SCOPES = ["openid", "email", "profile"]


@app.route("/login/google")
def google_login():
    # Generate and store an anti-CSRF state token in the session
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "state": state,
        "access_type": "offline",
        "prompt": "consent select_account",
    }
    return redirect(f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}")


@app.route("/login/google/callback")
def google_callback():
    # Handle error returned by Google (e.g. user denied consent)
    if "error" in request.args:
        abort(400, description=f"OAuth error: {request.args.get('error')}")

    # Validate anti-CSRF state
    expected_state = session.pop("oauth_state", None)
    received_state = request.args.get("state")
    if not expected_state or not received_state or not secrets.compare_digest(
        expected_state, received_state
    ):
        abort(400, description="Invalid OAuth state.")

    code = request.args.get("code")
    if not code:
        abort(400, description="Missing authorization code.")

    # Exchange the authorization code for tokens
    token_payload = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    try:
        token_resp = requests.post(
            GOOGLE_TOKEN_ENDPOINT, data=token_payload, timeout=10
        )
        token_resp.raise_for_status()
    except requests.RequestException:
        abort(502, description="Failed to exchange authorization code.")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")
    if not access_token:
        abort(502, description="No access token returned by Google.")

    # Fetch the user's profile information
    try:
        userinfo_resp = requests.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        userinfo_resp.raise_for_status()
    except requests.RequestException:
        abort(502, description="Failed to fetch user info.")

    userinfo = userinfo_resp.json()

    if not userinfo.get("email_verified", False):
        abort(403, description="Google account email is not verified.")

    # Persist the authenticated user in the session
    session.permanent = True
    session["user"] = {
        "sub": userinfo.get("sub"),
        "email": userinfo.get("email"),
        "name": userinfo.get("name"),
        "picture": userinfo.get("picture"),
    }

    return redirect(url_for("profile"))


def login_required(view):
    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("google_login"))
        return view(*args, **kwargs)

    return wrapper


@app.route("/profile")
@login_required
def profile():
    return jsonify(session["user"])


@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out."})


if __name__ == "__main__":
    app.run(debug=True)