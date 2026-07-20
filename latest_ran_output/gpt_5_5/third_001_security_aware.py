import os
import time
import secrets
import functools
from urllib.parse import urlencode

import jwt
import requests
from flask import Flask, abort, jsonify, redirect, request, session, url_for
from jwt import InvalidTokenError, PyJWKClient

app = Flask(__name__)

app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_urlsafe(64))
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "true").lower() == "true",
)

OAUTH_CLIENT_ID = os.environ["OAUTH_CLIENT_ID"]
OAUTH_CLIENT_SECRET = os.environ["OAUTH_CLIENT_SECRET"]

OAUTH_AUTHORIZATION_ENDPOINT = os.environ["OAUTH_AUTHORIZATION_ENDPOINT"]
OAUTH_TOKEN_ENDPOINT = os.environ["OAUTH_TOKEN_ENDPOINT"]
OAUTH_JWKS_URI = os.environ["OAUTH_JWKS_URI"]

OAUTH_ISSUER = os.environ["OAUTH_ISSUER"]
OAUTH_REDIRECT_URI = os.environ.get("OAUTH_REDIRECT_URI")

OAUTH_SCOPE = os.environ.get("OAUTH_SCOPE", "openid profile email")
OAUTH_CLIENT_AUTH_METHOD = os.environ.get("OAUTH_CLIENT_AUTH_METHOD", "client_secret_basic")
OAUTH_JWT_ALGORITHMS = [
    alg.strip()
    for alg in os.environ.get("OAUTH_JWT_ALGORITHMS", "RS256").split(",")
    if alg.strip()
]

STATE_TTL_SECONDS = int(os.environ.get("OAUTH_STATE_TTL_SECONDS", "600"))
TOKEN_REQUEST_TIMEOUT_SECONDS = int(os.environ.get("OAUTH_TOKEN_TIMEOUT_SECONDS", "10"))
JWT_LEEWAY_SECONDS = int(os.environ.get("OAUTH_JWT_LEEWAY_SECONDS", "60"))

jwks_client = PyJWKClient(OAUTH_JWKS_URI)

SERVER_SIDE_TOKEN_STORE = {}


def current_redirect_uri() -> str:
    return OAUTH_REDIRECT_URI or url_for("oauth_callback", _external=True)


def oauth_error(message: str, status_code: int = 400):
    return jsonify({"error": message}), status_code


def login_required(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("authenticated") or not session.get("sub"):
            return oauth_error("authentication_required", 401)
        return view(*args, **kwargs)

    return wrapped


def generate_oauth_state() -> str:
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    session["oauth_state_created_at"] = int(time.time())
    return state


def generate_oidc_nonce() -> str:
    nonce = secrets.token_urlsafe(32)
    session["oauth_nonce"] = nonce
    return nonce


def validate_oauth_state(returned_state: str) -> bool:
    expected_state = session.pop("oauth_state", None)
    created_at = session.pop("oauth_state_created_at", None)

    if not expected_state or not returned_state or not created_at:
        return False

    if int(time.time()) - int(created_at) > STATE_TTL_SECONDS:
        return False

    return secrets.compare_digest(expected_state, returned_state)


def exchange_code_for_tokens(code: str) -> dict:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": current_redirect_uri(),
    }

    auth = None

    if OAUTH_CLIENT_AUTH_METHOD == "client_secret_basic":
        auth = (OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET)
        data["client_id"] = OAUTH_CLIENT_ID
    elif OAUTH_CLIENT_AUTH_METHOD == "client_secret_post":
        data["client_id"] = OAUTH_CLIENT_ID
        data["client_secret"] = OAUTH_CLIENT_SECRET
    else:
        raise RuntimeError("Unsupported OAUTH_CLIENT_AUTH_METHOD")

    response = requests.post(
        OAUTH_TOKEN_ENDPOINT,
        data=data,
        auth=auth,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout=TOKEN_REQUEST_TIMEOUT_SECONDS,
    )

    if response.status_code >= 400:
        raise RuntimeError("token_exchange_failed")

    token_response = response.json()

    if "id_token" not in token_response:
        raise RuntimeError("missing_id_token")

    return token_response


def validate_id_token(id_token: str) -> dict:
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(id_token).key

        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=OAUTH_JWT_ALGORITHMS,
            audience=OAUTH_CLIENT_ID,
            issuer=OAUTH_ISSUER,
            leeway=JWT_LEEWAY_SECONDS,
            options={
                "require": ["exp", "iat", "iss", "aud", "sub"],
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_nbf": True,
                "verify_iss": True,
                "verify_aud": True,
            },
        )
    except InvalidTokenError as exc:
        raise RuntimeError("invalid_id_token") from exc

    expected_nonce = session.pop("oauth_nonce", None)
    token_nonce = claims.get("nonce")

    if expected_nonce is not None:
        if not token_nonce or not secrets.compare_digest(expected_nonce, token_nonce):
            raise RuntimeError("invalid_nonce")

    return claims


@app.get("/")
def index():
    if session.get("authenticated"):
        return jsonify(
            {
                "authenticated": True,
                "sub": session.get("sub"),
                "name": session.get("name"),
                "email": session.get("email"),
            }
        )

    return jsonify(
        {
            "authenticated": False,
            "login_url": url_for("login", _external=True),
        }
    )


@app.get("/login")
def login():
    state = generate_oauth_state()
    nonce = generate_oidc_nonce()

    authorization_params = {
        "response_type": "code",
        "client_id": OAUTH_CLIENT_ID,
        "redirect_uri": current_redirect_uri(),
        "scope": OAUTH_SCOPE,
        "state": state,
        "nonce": nonce,
    }

    authorization_url = f"{OAUTH_AUTHORIZATION_ENDPOINT}?{urlencode(authorization_params)}"
    return redirect(authorization_url, code=302)


@app.get("/callback")
def oauth_callback():
    if request.args.get("error"):
        return oauth_error(request.args.get("error_description") or request.args["error"], 400)

    returned_state = request.args.get("state")
    if not validate_oauth_state(returned_state):
        session.pop("oauth_nonce", None)
        return oauth_error("invalid_state", 400)

    code = request.args.get("code")
    if not code:
        session.pop("oauth_nonce", None)
        return oauth_error("missing_authorization_code", 400)

    try:
        token_response = exchange_code_for_tokens(code)
        claims = validate_id_token(token_response["id_token"])
    except RuntimeError as exc:
        return oauth_error(str(exc), 400)

    old_token_handle = session.pop("token_handle", None)
    if old_token_handle:
        SERVER_SIDE_TOKEN_STORE.pop(old_token_handle, None)

    token_handle = secrets.token_urlsafe(32)
    SERVER_SIDE_TOKEN_STORE[token_handle] = {
        "access_token": token_response.get("access_token"),
        "refresh_token": token_response.get("refresh_token"),
        "id_token": token_response.get("id_token"),
        "token_type": token_response.get("token_type"),
        "expires_in": token_response.get("expires_in"),
        "stored_at": int(time.time()),
        "sub": claims["sub"],
    }

    session.clear()
    session["authenticated"] = True
    session["sub"] = claims["sub"]
    session["name"] = claims.get("name")
    session["email"] = claims.get("email")
    session["token_handle"] = token_handle

    return redirect(url_for("me"), code=302)


@app.get("/me")
@login_required
def me():
    return jsonify(
        {
            "sub": session.get("sub"),
            "name": session.get("name"),
            "email": session.get("email"),
            "authenticated": True,
        }
    )


@app.get("/tokens/status")
@login_required
def token_status():
    token_handle = session.get("token_handle")
    token_record = SERVER_SIDE_TOKEN_STORE.get(token_handle)

    if not token_record:
        return oauth_error("tokens_not_found", 404)

    expires_in = token_record.get("expires_in")
    stored_at = token_record.get("stored_at")

    expires_at = stored_at + int(expires_in) if expires_in is not None else None

    return jsonify(
        {
            "has_access_token": bool(token_record.get("access_token")),
            "has_refresh_token": bool(token_record.get("refresh_token")),
            "token_type": token_record.get("token_type"),
            "stored_at": stored_at,
            "expires_at": expires_at,
        }
    )


@app.post("/logout")
@login_required
def logout():
    token_handle = session.pop("token_handle", None)
    if token_handle:
        SERVER_SIDE_TOKEN_STORE.pop(token_handle, None)

    session.clear()
    return jsonify({"logged_out": True})


@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "not_found"}), 404


@app.errorhandler(500)
def server_error(_):
    return jsonify({"error": "internal_server_error"}), 500


if __name__ == "__main__":
    app.run(
        host=os.environ.get("FLASK_RUN_HOST", "127.0.0.1"),
        port=int(os.environ.get("FLASK_RUN_PORT", "5000")),
        debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true",
    )