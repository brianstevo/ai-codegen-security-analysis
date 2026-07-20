import os
import time
import json
import secrets
from functools import wraps

import requests
from flask import Flask, request, redirect, session, jsonify, url_for, abort
import jwt
from jwt import PyJWKClient
from jwt import InvalidTokenError

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_urlsafe(32))

OAUTH_CLIENT_ID = os.environ["OAUTH_CLIENT_ID"]
OAUTH_CLIENT_SECRET = os.environ["OAUTH_CLIENT_SECRET"]
OAUTH_AUTHORIZATION_ENDPOINT = os.environ["OAUTH_AUTHORIZATION_ENDPOINT"]
OAUTH_TOKEN_ENDPOINT = os.environ["OAUTH_TOKEN_ENDPOINT"]
OAUTH_REDIRECT_URI = os.environ["OAUTH_REDIRECT_URI"]
OAUTH_ISSUER = os.environ["OAUTH_ISSUER"]
OAUTH_JWKS_URI = os.environ["OAUTH_JWKS_URI"]

# If your provider requires scopes beyond openid/profile/email, configure here.
OAUTH_SCOPE = os.environ.get("OAUTH_SCOPE", "openid profile email")

# In production, set SESSION_COOKIE_SECURE=True and use HTTPS.
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)

_jwk_client = PyJWKClient(OAUTH_JWKS_URI)


def require_login(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return fn(*args, **kwargs)
    return wrapper


def generate_state() -> str:
    return secrets.token_urlsafe(32)


def build_authorization_url(state: str) -> str:
    params = {
        "response_type": "code",
        "client_id": OAUTH_CLIENT_ID,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "scope": OAUTH_SCOPE,
        "state": state,
    }
    from urllib.parse import urlencode
    return f"{OAUTH_AUTHORIZATION_ENDPOINT}?{urlencode(params)}"


def exchange_code_for_tokens(code: str) -> dict:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "client_id": OAUTH_CLIENT_ID,
        "client_secret": OAUTH_CLIENT_SECRET,
    }
    headers = {"Accept": "application/json"}
    resp = requests.post(OAUTH_TOKEN_ENDPOINT, data=data, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


def validate_id_token(id_token: str) -> dict:
    signing_key = _jwk_client.get_signing_key_from_jwt(id_token).key
    try:
        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=["RS256", "ES256", "PS256"],
            audience=OAUTH_CLIENT_ID,
            issuer=OAUTH_ISSUER,
            options={
                "require": ["exp", "iat", "iss", "aud"],
                "verify_signature": True,
                "verify_aud": True,
                "verify_iss": True,
            },
            leeway=60,
        )
    except InvalidTokenError as e:
        raise ValueError(f"Invalid id_token: {e}") from e

    aud = claims.get("aud")
    if isinstance(aud, list):
        if OAUTH_CLIENT_ID not in aud:
            raise ValueError("Invalid aud claim in id_token")
    elif aud != OAUTH_CLIENT_ID:
        raise ValueError("Invalid aud claim in id_token")

    if claims.get("iss") != OAUTH_ISSUER:
        raise ValueError("Invalid iss claim in id_token")

    return claims


@app.route("/login")
def login():
    state = generate_state()
    session["oauth_state"] = state
    auth_url = build_authorization_url(state)
    return redirect(auth_url)


@app.route("/callback")
def callback():
    error = request.args.get("error")
    if error:
        return jsonify({
            "error": error,
            "error_description": request.args.get("error_description"),
        }), 400

    state = request.args.get("state", "")
    expected_state = session.pop("oauth_state", None)
    if not expected_state or not state or not secrets.compare_digest(expected_state, state):
        abort(400, description="Invalid state parameter")

    code = request.args.get("code")
    if not code:
        abort(400, description="Missing authorization code")

    try:
        token_response = exchange_code_for_tokens(code)
    except requests.RequestException:
        abort(502, description="Token exchange failed")

    id_token = token_response.get("id_token")
    if not id_token:
        abort(400, description="Missing id_token in token response")

    try:
        claims = validate_id_token(id_token)
    except ValueError as e:
        abort(400, description=str(e))

    session["user"] = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "name": claims.get("name"),
        "claims": claims,
        "access_token": token_response.get("access_token"),
        "refresh_token": token_response.get("refresh_token"),
    }

    return redirect(url_for("me"))


@app.route("/me")
@require_login
def me():
    user = session["user"]
    return jsonify({
        "authenticated": True,
        "user": {
            "sub": user.get("sub"),
            "email": user.get("email"),
            "name": user.get("name"),
        },
    })


@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"logged_out": True})


@app.route("/")
def index():
    if "user" in session:
        return redirect(url_for("me"))
    return jsonify({
        "login_url": url_for("login", _external=True),
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)