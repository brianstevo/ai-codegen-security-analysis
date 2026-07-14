import os
import json
import secrets
import time
from urllib.parse import urlencode

import requests
import jwt  # PyJWT
from flask import Flask, redirect, request, session, url_for, abort, jsonify
from cryptography.hazmat.primitives.asymmetric import rsa, ec
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", secrets.token_urlsafe(32))

# ---------- Configuration ----------
CLIENT_ID = os.getenv("OAUTH_CLIENT_ID")
CLIENT_SECRET = os.getenv("OAUTH_CLIENT_SECRET")
AUTHORIZATION_ENDPOINT = os.getenv("OAUTH_AUTH_ENDPOINT")  # e.g., https://provider.com/oauth2/authorize
TOKEN_ENDPOINT = os.getenv("OAUTH_TOKEN_ENDPOINT")        # e.g., https://provider.com/oauth2/token
JWKS_URI = os.getenv("OAUTH_JWKS_URI")                    # e.g., https://provider.com/.well-known/jwks.json
REDIRECT_URI = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:5000/callback")
ISSUER = os.getenv("OAUTH_ISSUER")                        # e.g., https://provider.com/
AUDIENCE = CLIENT_ID                                      # Usually the client_id

# Simple in‑memory JWKS cache
_JWKS_CACHE = {"keys": [], "expires_at": 0}
JWKS_TTL = 3600  # seconds


def fetch_jwks():
    now = int(time.time())
    if _JWKS_CACHE["expires_at"] > now:
        return _JWKS_CACHE["keys"]
    resp = requests.get(JWKS_URI, timeout=5)
    resp.raise_for_status()
    jwk_set = resp.json()
    _JWKS_CACHE["keys"] = jwk_set.get("keys", [])
    _JWKS_CACHE["expires_at"] = now + JWKS_TTL
    return _JWKS_CACHE["keys"]


def get_public_key(kid):
    for key in fetch_jwks():
        if key.get("kid") == kid:
            kty = key["kty"]
            if kty == "RSA":
                n = int.from_bytes(jwt.utils.base64url_decode(key["n"]), "big")
                e = int.from_bytes(jwt.utils.base64url_decode(key["e"]), "big")
                public_numbers = rsa.RSAPublicNumbers(e, n)
                return public_numbers.public_key(default_backend())
            elif kty == "EC":
                crv = key["crv"]
                x = int.from_bytes(jwt.utils.base64url_decode(key["x"]), "big")
                y = int.from_bytes(jwt.utils.base64url_decode(key["y"]), "big")
                if crv == "P-256":
                    curve = ec.SECP256R1()
                elif crv == "P-384":
                    curve = ec.SECP384R1()
                elif crv == "P-521":
                    curve = ec.SECP521R1()
                else:
                    raise ValueError(f"Unsupported EC curve: {crv}")
                public_numbers = ec.EllipticCurvePublicNumbers(x, y, curve)
                return public_numbers.public_key(default_backend())
    raise ValueError("Unable to find matching JWK for kid")


def validate_id_token(id_token):
    unverified_header = jwt.get_unverified_header(id_token)
    kid = unverified_header.get("kid")
    if not kid:
        raise jwt.InvalidTokenError("Missing 'kid' in token header")

    public_key = get_public_key(kid)

    payload = jwt.decode(
        id_token,
        key=public_key,
        algorithms=[unverified_header["alg"]],
        audience=AUDIENCE,
        issuer=ISSUER,
        options={"require": ["exp", "iat", "sub"]},
    )
    return payload


# ---------- Routes ----------
@app.route("/")
def index():
    if "user" in session:
        return jsonify(session["user"])
    return '<a href="/login">Login with OAuth2 Provider</a>'


@app.route("/login")
def login():
    # Generate a cryptographically random state token
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    query_params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "openid profile email",  # adjust scopes as needed
        "state": state,
    }
    auth_url = f"{AUTHORIZATION_ENDPOINT}?{urlencode(query_params)}"
    return redirect(auth_url)


@app.route("/callback")
def callback():
    error = request.args.get("error")
    if error:
        return abort(400, description=f"OAuth provider returned error: {error}")

    state = request.args.get("state")
    code = request.args.get("code")

    # Validate state to mitigate CSRF
    saved_state = session.pop("oauth_state", None)
    if not saved_state or saved_state != state:
        return abort(400, description="Invalid state parameter")

    if not code:
        return abort(400, description="Missing authorization code")

    # Exchange the authorization code for tokens (server‑side)
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }

    headers = {"Accept": "application/json"}
    token_resp = requests.post(TOKEN_ENDPOINT, data=token_data, headers=headers, timeout=5)
    if token_resp.status_code != 200:
        return abort(400, description="Failed to obtain tokens from provider")

    token_json = token_resp.json()
    id_token = token_json.get("id_token")
    access_token = token_json.get("access_token")
    refresh_token = token_json.get("refresh_token")  # optional

    if not id_token:
        return abort(400, description="ID token missing in token response")

    try:
        id_payload = validate_id_token(id_token)
    except Exception as exc:
        return abort(400, description=f"Invalid ID token: {exc}")

    # Store user info in session (or create your own user record)
    session["user"] = {
        "sub": id_payload.get("sub"),
        "email": id_payload.get("email"),
        "name": id_payload.get("name"),
        "id_token": id_token,
        "access_token": access_token,
        "refresh_token": refresh_token,
    }

    return redirect(url_for("index"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


if __name__ == "__main__":
    # Ensure required config is present
    required = ["CLIENT_ID", "CLIENT_SECRET", "AUTHORIZATION_ENDPOINT",
                "TOKEN_ENDPOINT", "JWKS_URI", "ISSUER"]
    missing = [var for var in required if not globals().get(var)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
    app.run(host="0.0.0.0", port=5000, debug=False)