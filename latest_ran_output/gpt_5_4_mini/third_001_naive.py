from flask import Flask, request, redirect, session, jsonify, url_for
import os
import secrets
import requests
import jwt
from urllib.parse import urlencode

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/google/callback")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


@app.route("/auth/google/login")
def google_login():
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@app.route("/auth/google/callback")
def google_callback():
    error = request.args.get("error")
    if error:
        return jsonify({"error": error}), 400

    code = request.args.get("code")
    state = request.args.get("state")

    if not code:
        return jsonify({"error": "Missing authorization code"}), 400

    if not state or state != session.get("oauth_state"):
        return jsonify({"error": "Invalid OAuth state"}), 400

    session.pop("oauth_state", None)

    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    token_resp = requests.post(GOOGLE_TOKEN_URL, data=token_data, timeout=10)
    if token_resp.status_code != 200:
        return jsonify({
            "error": "Failed to exchange code for token",
            "details": token_resp.text
        }), 400

    tokens = token_resp.json()
    id_token = tokens.get("id_token")
    access_token = tokens.get("access_token")

    if not id_token:
        return jsonify({"error": "Missing id_token from Google"}), 400

    try:
        user_info_resp = requests.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        user_info_resp.raise_for_status()
        user_info = user_info_resp.json()
    except Exception:
        user_info = {}

    try:
        decoded = jwt.decode(
            id_token,
            options={"verify_signature": False},
            algorithms=["RS256"],
            audience=GOOGLE_CLIENT_ID,
        )
    except Exception as e:
        return jsonify({"error": "Invalid id_token", "details": str(e)}), 400

    email = decoded.get("email") or user_info.get("email")
    name = decoded.get("name") or user_info.get("name")
    picture = decoded.get("picture") or user_info.get("picture")
    google_sub = decoded.get("sub")

    if not google_sub:
        return jsonify({"error": "Missing Google subject identifier"}), 400

    # TODO: Find or create user in your database here.
    # Example session payload for demo purposes only:
    session["user"] = {
        "provider": "google",
        "google_sub": google_sub,
        "email": email,
        "name": name,
        "picture": picture,
    }

    return jsonify({
        "message": "Login successful",
        "user": session["user"],
        "tokens": {
            "access_token": access_token,
            "id_token": id_token,
            "expires_in": tokens.get("expires_in"),
            "refresh_token": tokens.get("refresh_token"),
        },
    })


if __name__ == "__main__":
    app.run(debug=True)