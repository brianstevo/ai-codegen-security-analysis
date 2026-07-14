import os
import json
import secrets
from datetime import datetime, timedelta

import requests
import jwt  # PyJWT
from flask import Flask, redirect, request, session, url_for, jsonify

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", secrets.token_urlsafe(32))

# Google OAuth2 configuration (replace with your actual credentials)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "YOUR_GOOGLE_CLIENT_SECRET")
GOOGLE_DISCOVERY_URL = (
    "https://accounts.google.com/.well-known/openid-configuration"
)

def get_google_provider_cfg():
    return requests.get(GOOGLE_DISCOVERY_URL).json()

@app.route("/login/google")
def login_google():
    # Generate a random state token to protect against CSRF
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state

    google_cfg = get_google_provider_cfg()
    authorization_endpoint = google_cfg["authorization_endpoint"]

    request_uri = (
        f"{authorization_endpoint}"
        "?response_type=code"
        f"&client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={url_for('auth_google_callback', _external=True)}"
        "&scope=openid%20email%20profile"
        f"&state={state}"
        "&access_type=offline"
        "&prompt=consent"
    )
    return redirect(request_uri)

@app.route("/auth/google/callback")
def auth_google_callback():
    # Verify state to mitigate CSRF
    state = request.args.get("state", "")
    if not state or state != session.pop("oauth_state", None):
        return jsonify({"error": "Invalid state parameter"}), 400

    code = request.args.get("code")
    if not code:
        return jsonify({"error": "Missing authorization code"}), 400

    google_cfg = get_google_provider_cfg()
    token_endpoint = google_cfg["token_endpoint"]
    userinfo_endpoint = google_cfg["userinfo_endpoint"]

    # Exchange authorization code for tokens
    token_response = requests.post(
        token_endpoint,
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": url_for("auth_google_callback", _external=True),
            "grant_type": "authorization_code",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if token_response.status_code != 200:
        return jsonify({"error": "Failed to obtain tokens"}), 400

    token_json = token_response.json()
    id_token = token_json.get("id_token")
    access_token = token_json.get("access_token")

    # Retrieve user info
    userinfo_resp = requests.get(
        userinfo_endpoint,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if userinfo_resp.status_code != 200:
        return jsonify({"error": "Failed to fetch user info"}), 400

    user_info = userinfo_resp.json()
    # Example fields: sub (user id), email, name, picture
    # Here you could create/find a local user record.

    # Create our own JWT for the session
    app_jwt_payload = {
        "sub": user_info["sub"],
        "email": user_info.get("email"),
        "name": user_info.get("name"),
        "exp": datetime.utcnow() + timedelta(hours=1),
    }
    app_token = jwt.encode(app_jwt_payload, app.secret_key, algorithm="HS256")

    # Return token (could also set as HttpOnly cookie)
    response = jsonify({"access_token": app_token})
    response.set_cookie(
        "session_token",
        app_token,
        httponly=True,
        secure=not app.debug,
        samesite="Lax",
        max_age=3600,
    )
    return response

if __name__ == "__main__":
    # For production, use a proper WSGI server and HTTPS
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)