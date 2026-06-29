import os
import time
import secrets
from functools import wraps
from urllib.parse import urlencode

import requests
from flask import Flask, redirect, request, session, url_for, jsonify, abort
import jwt
from jwt import PyJWKClient

# ----------------------------
# Configuration
# ----------------------------
# Set these via environment variables in production.
OIDC_CLIENT_ID = os.getenv("OIDC_CLIENT_ID", "your-client-id")
OIDC_CLIENT_SECRET = os.getenv("OIDC_CLIENT_SECRET", "your-client-secret")
OIDC_DISCOVERY_URL = os.getenv(
    "OIDC_DISCOVERY_URL",
    "https://accounts.google.com/.well-known/openid-configuration",
)
# e.g. "http://localhost:5000/callback" (must match provider registration)
OIDC_REDIRECT_URI = os.getenv("OIDC_REDIRECT_URI", "http://localhost:5000/callback")
SESSION_SECRET = os.getenv("SESSION_SECRET", secrets.token_hex(32))

# Optional strict issuer override if you want exact single value.
EXPECTED_ISSUER = os.getenv("EXPECTED_ISSUER", "").strip()

app = Flask(__name__)
app.secret_key = SESSION_SECRET
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  # set True behind HTTPS
)


# ----------------------------
# OIDC metadata cache
# ----------------------------
_oidc_metadata_cache = {"value": None, "expires_at": 0}


def get_oidc_metadata():
    now = time.time()
    if _oidc_metadata_cache["value"] and now < _oidc_metadata_cache["expires_at"]:
        return _oidc_metadata_cache["value"]

    resp = requests.get(OIDC_DISCOVERY_URL, timeout=10)
    resp.raise_for_status()
    metadata = resp.json()

    # Cache for 1 hour
    _oidc_metadata_cache["value"] = metadata
    _oidc_metadata_cache["expires_at"] = now + 3600
    return metadata


# ----------------------------
# Helpers
# ----------------------------
def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return fn(*args, **kwargs)

    return wrapper


def expected_issuers_from_metadata(metadata):
    # Some providers may return issuer variants (e.g., Google)
    issuers = set()
    if metadata.get("issuer"):
        issuers.add(metadata["issuer"])
    if EXPECTED_ISSUER:
        issuers = {EXPECTED_ISSUER}
    return issuers


def validate_id_token(id_token, metadata):
    jwks_uri = metadata["jwks_uri"]
    issuer_candidates = expected_issuers_from_metadata(metadata)

    jwk_client = PyJWKClient(jwks_uri)
    signing_key = jwk_client.get_signing_key_from_jwt(id_token)

    # Decode and verify signature, audience, issuer, exp/iat/nbf (where present)
    decoded = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256", "ES256", "PS256"],  # accept common secure algs
        audience=OIDC_CLIENT_ID,
        options={
            "require": ["exp", "iat", "iss", "aud", "sub"],
            "verify_signature": True,
            "verify_aud": True,
            "verify_iss": False,  # manual issuer check for candidate support
        },
    )

    iss = decoded.get("iss")
    if iss not in issuer_candidates:
        raise jwt.InvalidIssuerError(f"Unexpected issuer: {iss}")

    aud = decoded.get("aud")
    if isinstance(aud, str):
        if aud != OIDC_CLIENT_ID:
            raise jwt.InvalidAudienceError("Invalid audience")
    elif isinstance(aud, list):
        if OIDC_CLIENT_ID not in aud:
            raise jwt.InvalidAudienceError("Client ID not in audience")
    else:
        raise jwt.InvalidAudienceError("Malformed audience")

    return decoded


# ----------------------------
# Routes
# ----------------------------
@app.route("/")
def index():
    user = session.get("user")
    if user:
        return jsonify(
            {
                "logged_in": True,
                "user": user,
                "message": "Authenticated via OAuth 2.0 Authorization Code Flow",
            }
        )
    return jsonify(
        {
            "logged_in": False,
            "message": "Visit /login to start OAuth 2.0 Authorization Code Flow",
        }
    )


@app.route("/login")
def login():
    metadata = get_oidc_metadata()
    authorization_endpoint = metadata["authorization_endpoint"]

    # CSRF protection: cryptographically secure random state
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    # Optional nonce for OIDC replay protection
    nonce = secrets.token_urlsafe(32)
    session["oidc_nonce"] = nonce

    params = {
        "client_id": OIDC_CLIENT_ID,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": OIDC_REDIRECT_URI,
        "state": state,
        "nonce": nonce,
    }

    auth_url = f"{authorization_endpoint}?{urlencode(params)}"
    return redirect(auth_url)


@app.route("/callback")
def callback():
    # Handle provider error
    error = request.args.get("error")
    if error:
        return jsonify({"error": error, "error_description": request.args.get("error_description")}), 400

    code = request.args.get("code")
    returned_state = request.args.get("state")

    if not code or not returned_state:
        return jsonify({"error": "Missing code or state"}), 400

    # Validate state to prevent CSRF
    stored_state = session.pop("oauth_state", None)
    if not stored_state or not secrets.compare_digest(stored_state, returned_state):
        return jsonify({"error": "Invalid state parameter"}), 400

    metadata = get_oidc_metadata()
    token_endpoint = metadata["token_endpoint"]

    # Exchange code for tokens server-side (client_secret never exposed to browser)
    token_resp = requests.post(
        token_endpoint,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": OIDC_REDIRECT_URI,
            "client_id": OIDC_CLIENT_ID,
            "client_secret": OIDC_CLIENT_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )

    if token_resp.status_code != 200:
        return jsonify({"error": "Token exchange failed", "details": token_resp.text}), 400

    token_data = token_resp.json()
    id_token = token_data.get("id_token")
    access_token = token_data.get("access_token")

    if not id_token:
        return jsonify({"error": "No id_token returned by provider"}), 400

    try:
        claims = validate_id_token(id_token, metadata)
    except jwt.PyJWTError as e:
        return jsonify({"error": "Invalid id_token", "details": str(e)}), 400

    # Validate nonce if present
    nonce_in_token = claims.get("nonce")
    expected_nonce = session.pop("oidc_nonce", None)
    if expected_nonce:
        if not nonce_in_token or not secrets.compare_digest(expected_nonce, nonce_in_token):
            return jsonify({"error": "Invalid nonce"}), 400

    # Persist a minimal authenticated session
    session["user"] = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "name": claims.get("name"),
        "iss": claims.get("iss"),
        "aud": claims.get("aud"),
    }

    # Store tokens in server-side session only (avoid exposing secrets/tokens to browser JS)
    session["tokens"] = {
        "access_token": access_token,
        "id_token": id_token,
        "token_type": token_data.get("token_type"),
        "expires_in": token_data.get("expires_in"),
        "scope": token_data.get("scope"),
    }

    return redirect(url_for("profile"))


@app.route("/profile")
@login_required
def profile():
    return jsonify({"user": session["user"]})


@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/health")
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)