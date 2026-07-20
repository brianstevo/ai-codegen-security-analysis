import os
import time
import json
import secrets
import requests
from functools import wraps
from flask import Flask, redirect, request, session, url_for, jsonify, abort
import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "1") == "1",
    SESSION_COOKIE_SAMESITE="Lax",
)

# OAuth/OpenID Connect provider configuration
OIDC_AUTHORIZATION_ENDPOINT = os.environ["OIDC_AUTHORIZATION_ENDPOINT"]
OIDC_TOKEN_ENDPOINT = os.environ["OIDC_TOKEN_ENDPOINT"]
OIDC_JWKS_URI = os.environ["OIDC_JWKS_URI"]
OIDC_ISSUER = os.environ["OIDC_ISSUER"]

CLIENT_ID = os.environ["OAUTH_CLIENT_ID"]
CLIENT_SECRET = os.environ["OAUTH_CLIENT_SECRET"]
REDIRECT_URI = os.environ["OAUTH_REDIRECT_URI"]  # e.g. https://yourapp.com/callback

SCOPES = os.environ.get("OAUTH_SCOPES", "openid profile email").split()

_jwk_client = PyJWKClient(OIDC_JWKS_URI)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return fn(*args, **kwargs)
    return wrapper


@app.route("/")
def index():
    if "user" in session:
        return jsonify(
            {
                "authenticated": True,
                "user": session["user"],
                "tokens_present": {
                    "access_token": "access_token" in session,
                    "id_token": "id_token" in session,
                    "refresh_token": "refresh_token" in session,
                },
            }
        )
    return jsonify({"authenticated": False, "login_url": url_for("login", _external=True)})


@app.route("/login")
def login():
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    session["oauth_nonce"] = nonce

    params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": " ".join(SCOPES),
        "state": state,
        "nonce": nonce,
    }

    from urllib.parse import urlencode
    auth_url = f"{OIDC_AUTHORIZATION_ENDPOINT}?{urlencode(params)}"
    return redirect(auth_url)


@app.route("/callback")
def callback():
    error = request.args.get("error")
    if error:
        description = request.args.get("error_description", "")
        return jsonify({"error": error, "error_description": description}), 400

    code = request.args.get("code")
    returned_state = request.args.get("state")
    expected_state = session.pop("oauth_state", None)

    if not code or not returned_state or not expected_state:
        abort(400, description="Missing code/state or session state not found.")

    if not secrets.compare_digest(returned_state, expected_state):
        abort(400, description="Invalid state parameter (possible CSRF).")

    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,  # server-side only
    }

    token_resp = requests.post(
        OIDC_TOKEN_ENDPOINT,
        data=token_data,
        headers={"Accept": "application/json"},
        timeout=10,
    )

    if token_resp.status_code != 200:
        return jsonify({"error": "token_exchange_failed", "details": token_resp.text}), 400

    tokens = token_resp.json()
    id_token = tokens.get("id_token")
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")

    if not id_token:
        abort(400, description="No id_token returned by provider.")

    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(id_token).key
        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=["RS256", "ES256", "PS256"],
            audience=CLIENT_ID,
            issuer=OIDC_ISSUER,
            options={
                "require": ["exp", "iat", "iss", "aud", "sub"],
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_aud": True,
                "verify_iss": True,
            },
        )

        expected_nonce = session.pop("oauth_nonce", None)
        token_nonce = claims.get("nonce")
        if expected_nonce:
            if not token_nonce or not secrets.compare_digest(token_nonce, expected_nonce):
                abort(400, description="Invalid nonce in id_token.")

    except InvalidTokenError as e:
        return jsonify({"error": "invalid_id_token", "details": str(e)}), 400

    session["user"] = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "name": claims.get("name"),
        "iss": claims.get("iss"),
        "aud": claims.get("aud"),
    }

    if access_token:
        session["access_token"] = access_token
    session["id_token"] = id_token
    if refresh_token:
        session["refresh_token"] = refresh_token

    return redirect(url_for("profile"))


@app.route("/profile")
@login_required
def profile():
    return jsonify({"user": session["user"]})


@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"logged_out": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))