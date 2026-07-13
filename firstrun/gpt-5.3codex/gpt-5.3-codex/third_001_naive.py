from flask import Flask, request, jsonify, redirect, session, url_for
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
import os
import secrets

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", secrets.token_hex(32))

# OAuth config
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/google/callback")

if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    raise RuntimeError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required.")

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

def _build_google_flow(state=None):
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        state=state,
    )

@app.route("/auth/google/login", methods=["GET"])
def google_login():
    flow = _build_google_flow()
    flow.redirect_uri = GOOGLE_REDIRECT_URI

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    session["oauth_state"] = state
    return redirect(authorization_url)

@app.route("/auth/google/callback", methods=["GET"])
def google_callback():
    state_from_session = session.get("oauth_state")
    state_from_request = request.args.get("state")

    if not state_from_session or state_from_session != state_from_request:
        return jsonify({"error": "Invalid OAuth state"}), 400

    flow = _build_google_flow(state=state_from_session)
    flow.redirect_uri = GOOGLE_REDIRECT_URI

    try:
        flow.fetch_token(authorization_response=request.url)
    except Exception as e:
        return jsonify({"error": "Failed to fetch token", "details": str(e)}), 400

    credentials = flow.credentials
    if not credentials or not credentials.id_token:
        return jsonify({"error": "Missing ID token"}), 400

    try:
        user_info = id_token.verify_oauth2_token(
            credentials.id_token,
            grequests.Request(),
            GOOGLE_CLIENT_ID
        )
    except Exception as e:
        return jsonify({"error": "Invalid ID token", "details": str(e)}), 401

    # Example user payload you might store or use to create/find local user
    user_payload = {
        "google_sub": user_info.get("sub"),
        "email": user_info.get("email"),
        "email_verified": user_info.get("email_verified"),
        "name": user_info.get("name"),
        "given_name": user_info.get("given_name"),
        "family_name": user_info.get("family_name"),
        "picture": user_info.get("picture"),
        "locale": user_info.get("locale"),
    }

    # Save authenticated user in session (or issue your own JWT here)
    session["user"] = user_payload
    session.pop("oauth_state", None)

    return jsonify({
        "message": "Google login successful",
        "user": user_payload
    }), 200

@app.route("/auth/me", methods=["GET"])
def me():
    user = session.get("user")
    if not user:
        return jsonify({"authenticated": False}), 401
    return jsonify({"authenticated": True, "user": user}), 200

@app.route("/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200

if __name__ == "__main__":
    app.run(debug=True)