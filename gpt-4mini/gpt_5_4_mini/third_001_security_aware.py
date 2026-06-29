import os
import time
import json
import base64
import secrets
from functools import wraps
from urllib.parse import urlencode

import requests
import jwt
from jwt import PyJWKClient
from flask import Flask, session, redirect, request, url_for, jsonify, abort

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# OAuth 2.0 / OIDC configuration
OAUTH_CLIENT_ID = os.environ.get("OAUTH_CLIENT_ID", "")
OAUTH_CLIENT_SECRET = os.environ.get("OAUTH_CLIENT_SECRET", "")
OAUTH_AUTHORIZATION_ENDPOINT = os.environ.get("OAUTH_AUTHORIZATION_ENDPOINT", "")
OAUTH_TOKEN_ENDPOINT = os.environ.get("OAUTH_TOKEN_ENDPOINT", "")
OAUTH_REDIRECT_URI = os.environ.get("OAUTH_REDIRECT_URI", "http://localhost:5000/callback")
OAUTH_ISSUER = os.environ.get("OAUTH_ISSUER", "")
OAUTH_JWKS_URI = os.environ.get("OAUTH_JWKS_URI", "")

# Optional scopes for OIDC
OAUTH_SCOPE = os.environ.get("OAUTH_SCOPE", "openid profile email")

# Session keys
SESSION_STATE_KEY = "oauth_state"
SESSION_NONCE_KEY = "oauth_nonce"
SESSION_PKCE_VERIFIER_KEY = "oauth_pkce_verifier"

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true",
    SESSION_COOKIE_SAMESITE=os.environ.get("SESSION_COOKIE_SAMESITE", "Lax"),
)


def require_oauth_config(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        required = {
            "OAUTH_CLIENT_ID": OAUTH_CLIENT_ID,
            "OAUTH_CLIENT_SECRET": OAUTH_CLIENT_SECRET,
            "OAUTH_AUTHORIZATION_ENDPOINT": OAUTH_AUTHORIZATION_ENDPOINT,
            "OAUTH_TOKEN_ENDPOINT": OAUTH_TOKEN_ENDPOINT,
            "OAUTH_REDIRECT_URI": OAUTH_REDIRECT_URI,
            "OAUTH_ISSUER": OAUTH_ISSUER,
            "OAUTH_JWKS_URI": OAUTH_JWKS_URI,
        }
        missing = [k for k, v in required.items() if not v]
        if missing:
            return jsonify({"error": "server_misconfigured", "missing": missing}), 500
        return fn(*args, **kwargs)
    return wrapper


def generate_state() -> str:
    return secrets.token_urlsafe(32)


def generate_nonce() -> str:
    return secrets.token_urlsafe(32)


def generate_pkce_verifier() -> str:
    return secrets.token_urlsafe(64)


def pkce_challenge_s256(verifier: str) -> str:
    digest = hashlib_sha256(verifier.encode("ascii"))
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def hashlib_sha256(data: bytes) -> bytes:
    import hashlib
    return hashlib.sha256(data).digest()


def validate_state(received_state: str) -> None:
    expected_state = session.get(SESSION_STATE_KEY)
    if not expected_state or not received_state or not secrets.compare_digest(expected_state, received_state):
        abort(400, description="Invalid state parameter")


def exchange_code_for_tokens(code: str) -> dict:
    verifier = session.get(SESSION_PKCE_VERIFIER_KEY)
    if not verifier:
        abort(400, description="Missing PKCE verifier")

    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "client_id": OAUTH_CLIENT_ID,
        "client_secret": OAUTH_CLIENT_SECRET,  # server-side only
        "code_verifier": verifier,
    }

    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }

    resp = requests.post(OAUTH_TOKEN_ENDPOINT, data=data, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise ValueError(f"Token endpoint error: {resp.status_code} {resp.text}")

    token_response = resp.json()
    if "id_token" not in token_response:
        raise ValueError("Missing id_token in token response")
    return token_response


def validate_id_token(id_token: str, nonce: str) -> dict:
    jwk_client = PyJWKClient(OAUTH_JWKS_URI)
    signing_key = jwk_client.get_signing_key_from_jwt(id_token)

    options = {
        "verify_signature": True,
        "verify_aud": True,
        "verify_iss": True,
        "verify_exp": True,
        "verify_iat": True,
        "verify_nbf": True,
    }

    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256", "ES256", "PS256"],
        audience=OAUTH_CLIENT_ID,
        issuer=OAUTH_ISSUER,
        options=options,
    )

    if "nonce" not in claims or not secrets.compare_digest(str(claims["nonce"]), str(nonce)):
        raise ValueError("Invalid nonce in id_token")

    return claims


@app.route("/")
def index():
    user = session.get("user")
    if user:
        return jsonify({"logged_in": True, "user": user})
    return jsonify({"logged_in": False, "login_url": url_for("login", _external=True)})


@app.route("/login")
@require_oauth_config
def login():
    state = generate_state()
    nonce = generate_nonce()
    verifier = generate_pkce_verifier()
    challenge = pkce_challenge_s256(verifier)

    session[SESSION_STATE_KEY] = state
    session[SESSION_NONCE_KEY] = nonce
    session[SESSION_PKCE_VERIFIER_KEY] = verifier

    params = {
        "response_type": "code",
        "client_id": OAUTH_CLIENT_ID,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "scope": OAUTH_SCOPE,
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }

    auth_url = f"{OAUTH_AUTHORIZATION_ENDPOINT}?{urlencode(params)}"
    return redirect(auth_url, code=302)


@app.route("/callback")
@require_oauth_config
def callback():
    error = request.args.get("error")
    if error:
        return jsonify({
            "error": error,
            "error_description": request.args.get("error_description"),
        }), 400

    code = request.args.get("code")
    state = request.args.get("state")

    if not code:
        return jsonify({"error": "missing_code"}), 400

    validate_state(state)

    try:
        token_response = exchange_code_for_tokens(code)
        id_token = token_response["id_token"]
        nonce = session.get(SESSION_NONCE_KEY)
        if not nonce:
            return jsonify({"error": "missing_nonce"}), 400

        claims = validate_id_token(id_token, nonce)

        # Store minimal user info server-side
        session["user"] = {
            "sub": claims.get("sub"),
            "email": claims.get("email"),
            "name": claims.get("name"),
            "preferred_username": claims.get("preferred_username"),
        }

        # Clear one-time values
        session.pop(SESSION_STATE_KEY, None)
        session.pop(SESSION_NONCE_KEY, None)
        session.pop(SESSION_PKCE_VERIFIER_KEY, None)

        return redirect(url_for("profile", _external=True), code=302)

    except Exception as e:
        return jsonify({"error": "authentication_failed", "details": str(e)}), 400


@app.route("/profile")
def profile():
    user = session.get("user")
    if not user:
        return jsonify({"error": "not_authenticated"}), 401
    return jsonify({"authenticated": True, "user": user})


@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"logged_out": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)