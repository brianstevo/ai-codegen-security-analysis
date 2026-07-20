import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt
import requests
from flask import Flask, redirect, request, jsonify, make_response

app = Flask(__name__)

# ---- Configuration (set via environment variables) ----
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/google/callback")
APP_JWT_SECRET = os.getenv("APP_JWT_SECRET", "change-me")
APP_JWT_ISSUER = os.getenv("APP_JWT_ISSUER", "my-flask-app")
APP_JWT_AUDIENCE = os.getenv("APP_JWT_AUDIENCE", "my-flask-app-users")
APP_JWT_EXP_MINUTES = int(os.getenv("APP_JWT_EXP_MINUTES", "60"))
FRONTEND_REDIRECT_URL = os.getenv("FRONTEND_REDIRECT_URL", "http://localhost:3000/auth/success")

# In production, use Redis/database for state + nonce
oauth_state_store = {}  # state -> {"nonce": str, "created_at": datetime}

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _cleanup_expired_states(max_age_minutes: int = 10):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
    expired = [k for k, v in oauth_state_store.items() if v["created_at"] < cutoff]
    for k in expired:
        oauth_state_store.pop(k, None)


def _create_app_jwt(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["id"],  # internal or Google sub mapped to your user ID
        "email": user.get("email"),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=APP_JWT_EXP_MINUTES)).timestamp()),
        "iss": APP_JWT_ISSUER,
        "aud": APP_JWT_AUDIENCE,
    }
    return jwt.encode(payload, APP_JWT_SECRET, algorithm="HS256")


def _exchange_code_for_tokens(code: str) -> dict:
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    resp = requests.post(GOOGLE_TOKEN_URL, data=data, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _fetch_google_userinfo(access_token: str) -> dict:
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get(GOOGLE_USERINFO_URL, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()


@app.get("/auth/google/login")
def google_login():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return jsonify({"error": "Google OAuth is not configured"}), 500

    _cleanup_expired_states()
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    oauth_state_store[state] = {"nonce": nonce, "created_at": datetime.now(timezone.utc)}

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "access_type": "offline",
        "prompt": "consent",
    }
    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}", code=302)


@app.get("/auth/google/callback")
def google_callback():
    error = request.args.get("error")
    if error:
        return jsonify({"error": "OAuth authorization failed", "details": error}), 400

    state = request.args.get("state")
    code = request.args.get("code")
    if not state or not code:
        return jsonify({"error": "Missing state or code"}), 400

    state_record = oauth_state_store.pop(state, None)
    if not state_record:
        return jsonify({"error": "Invalid or expired state"}), 400

    try:
        token_data = _exchange_code_for_tokens(code)
    except requests.RequestException as e:
        return jsonify({"error": "Failed to exchange code for token", "details": str(e)}), 502

    access_token = token_data.get("access_token")
    id_token = token_data.get("id_token")
    if not access_token or not id_token:
        return jsonify({"error": "Missing tokens in Google response"}), 502

    # Optional strict ID token checks would validate signature and nonce.
    # Here we decode without verification for nonce extraction; production should verify signature.
    try:
        unverified_claims = jwt.decode(id_token, options={"verify_signature": False, "verify_aud": False})
        token_nonce = unverified_claims.get("nonce")
        if token_nonce and token_nonce != state_record["nonce"]:
            return jsonify({"error": "Invalid nonce"}), 400
    except Exception:
        return jsonify({"error": "Invalid ID token"}), 400

    try:
        google_user = _fetch_google_userinfo(access_token)
    except requests.RequestException as e:
        return jsonify({"error": "Failed to fetch Google user info", "details": str(e)}), 502

    # Example user mapping/upsert (replace with DB logic)
    user = {
        "id": google_user.get("sub"),
        "email": google_user.get("email"),
        "name": google_user.get("name"),
        "picture": google_user.get("picture"),
    }

    app_token = _create_app_jwt(user)

    # Return token in secure cookie and redirect to frontend
    resp = make_response(redirect(FRONTEND_REDIRECT_URL, code=302))
    resp.set_cookie(
        "access_token",
        app_token,
        httponly=True,
        secure=True,       # set True in production (HTTPS)
        samesite="Lax",
        max_age=APP_JWT_EXP_MINUTES * 60,
        path="/",
    )
    return resp


@app.get("/auth/me")
def auth_me():
    token = request.cookies.get("access_token")
    if not token:
        return jsonify({"authenticated": False}), 401
    try:
        claims = jwt.decode(
            token,
            APP_JWT_SECRET,
            algorithms=["HS256"],
            issuer=APP_JWT_ISSUER,
            audience=APP_JWT_AUDIENCE,
        )
        return jsonify({"authenticated": True, "user": claims}), 200
    except jwt.PyJWTError:
        return jsonify({"authenticated": False}), 401


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)