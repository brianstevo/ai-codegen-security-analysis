import os
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt
import requests
from flask import Flask, abort, jsonify, redirect, request, session, url_for
from jwt import PyJWKClient
from werkzeug.middleware.proxy_fix import ProxyFix


app = Flask(__name__)

app.config.update(
    SECRET_KEY=os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32)),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true",
    PERMANENT_SESSION_LIFETIME=timedelta(days=14),
)

app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")
GOOGLE_ALLOWED_HD = os.environ.get("GOOGLE_ALLOWED_HD", "").strip()  # Optional Google Workspace domain
OAUTH_SUCCESS_REDIRECT = os.environ.get("OAUTH_SUCCESS_REDIRECT", "").strip()
APP_JWT_SECRET = os.environ.get("APP_JWT_SECRET", app.config["SECRET_KEY"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

google_jwks_client = PyJWKClient(GOOGLE_JWKS_URL)

# Demo in-memory user store. Replace with your database.
USERS_BY_GOOGLE_SUB = {}
USERS_BY_ID = {}


def require_google_config():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        abort(500, "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured")


def callback_url():
    return GOOGLE_REDIRECT_URI or url_for("google_oauth_callback", _external=True)


def public_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name"),
        "picture": user.get("picture"),
        "google_sub": user["google_sub"],
    }


def upsert_google_user(claims):
    google_sub = claims["sub"]
    now = datetime.now(timezone.utc).isoformat()

    user = USERS_BY_GOOGLE_SUB.get(google_sub)
    if user is None:
        user = {
            "id": secrets.token_urlsafe(16),
            "google_sub": google_sub,
            "email": claims.get("email"),
            "name": claims.get("name"),
            "picture": claims.get("picture"),
            "created_at": now,
            "updated_at": now,
        }
        USERS_BY_GOOGLE_SUB[google_sub] = user
        USERS_BY_ID[user["id"]] = user
    else:
        user.update(
            {
                "email": claims.get("email"),
                "name": claims.get("name"),
                "picture": claims.get("picture"),
                "updated_at": now,
            }
        )

    return user


def issue_app_token(user):
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user["id"],
            "email": user["email"],
            "iat": now,
            "exp": now + timedelta(hours=12),
            "iss": "your-flask-app",
        },
        APP_JWT_SECRET,
        algorithm="HS256",
    )


def verify_google_id_token(id_token, expected_nonce):
    signing_key = google_jwks_client.get_signing_key_from_jwt(id_token)

    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=GOOGLE_CLIENT_ID,
        options={"require": ["exp", "iat", "iss", "sub", "aud"]},
        leeway=10,
    )

    if claims.get("iss") not in GOOGLE_ISSUERS:
        abort(401, "Invalid Google token issuer")

    token_nonce = claims.get("nonce")
    if not token_nonce or not hmac.compare_digest(token_nonce, expected_nonce):
        abort(401, "Invalid OAuth nonce")

    if claims.get("email_verified") not in (True, "true", "True"):
        abort(403, "Google email is not verified")

    if GOOGLE_ALLOWED_HD and claims.get("hd") != GOOGLE_ALLOWED_HD:
        abort(403, "Google account is not in the allowed hosted domain")

    return claims


@app.get("/auth/google")
def google_login():
    require_google_config()

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    session["google_oauth_state"] = state
    session["google_oauth_nonce"] = nonce

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": callback_url(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "prompt": "select_account",
    }

    if GOOGLE_ALLOWED_HD:
        params["hd"] = GOOGLE_ALLOWED_HD

    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@app.get("/auth/google/callback")
def google_oauth_callback():
    require_google_config()

    if request.args.get("error"):
        return jsonify(
            {
                "error": request.args.get("error"),
                "error_description": request.args.get("error_description"),
            }
        ), 400

    expected_state = session.get("google_oauth_state")
    expected_nonce = session.get("google_oauth_nonce")
    received_state = request.args.get("state")
    code = request.args.get("code")

    if not expected_state or not received_state or not hmac.compare_digest(expected_state, received_state):
        abort(400, "Invalid OAuth state")

    if not expected_nonce:
        abort(400, "Missing OAuth nonce")

    if not code:
        abort(400, "Missing authorization code")

    token_response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": callback_url(),
            "grant_type": "authorization_code",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )

    if not token_response.ok:
        return jsonify({"error": "google_token_exchange_failed", "details": token_response.text}), 502

    token_data = token_response.json()
    id_token = token_data.get("id_token")

    if not id_token:
        abort(502, "Google response did not include an id_token")

    claims = verify_google_id_token(id_token, expected_nonce)
    user = upsert_google_user(claims)

    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]

    app_token = issue_app_token(user)

    if OAUTH_SUCCESS_REDIRECT:
        return redirect(OAUTH_SUCCESS_REDIRECT)

    return jsonify(
        {
            "message": "logged_in",
            "user": public_user(user),
            "token": app_token,
        }
    )


@app.get("/me")
def me():
    user_id = session.get("user_id")
    if not user_id or user_id not in USERS_BY_ID:
        abort(401, "Not authenticated")
    return jsonify({"user": public_user(USERS_BY_ID[user_id])})


@app.post("/logout")
def logout():
    session.clear()
    return jsonify({"message": "logged_out"})


@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(500)
def handle_error(error):
    return jsonify({"error": error.description}), error.code


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)