```python
import os
import secrets
import hashlib
import base64
import logging
from datetime import datetime, timezone
from functools import wraps
from urllib.parse import urlencode, urlparse

import requests
import jwt
from flask import (
    Flask,
    redirect,
    request,
    session,
    url_for,
    jsonify,
    abort,
    render_template_string,
)
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App & configuration
# ---------------------------------------------------------------------------
app = Flask(__name__)

# Secret key for Flask sessions – use a long, random value in production
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# Session cookies: secure, HTTP-only, SameSite=Lax
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("FLASK_ENV") == "production",
    PERMANENT_SESSION_LIFETIME=600,  # 10 minutes
)

# ---------------------------------------------------------------------------
# OAuth 2.0 / OIDC provider settings  (Google used as example)
# ---------------------------------------------------------------------------
OAUTH_CONFIG = {
    "client_id": os.environ.get("OAUTH_CLIENT_ID", "YOUR_CLIENT_ID"),
    "client_secret": os.environ.get("OAUTH_CLIENT_SECRET", "YOUR_CLIENT_SECRET"),
    "redirect_uri": os.environ.get(
        "OAUTH_REDIRECT_URI", "http://localhost:5000/callback"
    ),
    # OIDC discovery – used to fetch all endpoint URLs and public keys
    "discovery_url": os.environ.get(
        "OAUTH_DISCOVERY_URL",
        "https://accounts.google.com/.well-known/openid-configuration",
    ),
    "scopes": ["openid", "email", "profile"],
    # Expected issuer (must match the 'iss' claim in the id_token)
    "issuer": os.environ.get("OAUTH_ISSUER", "https://accounts.google.com"),
}

# ---------------------------------------------------------------------------
# In-memory "store" for issued states / PKCE verifiers
# In production replace with a Redis / DB-backed store with TTL.
# ---------------------------------------------------------------------------
_pending_states: dict[str, dict] = {}  # state → {nonce, code_verifier, created_at}

# ---------------------------------------------------------------------------
# PKCE helpers (S256)
# ---------------------------------------------------------------------------

def _generate_code_verifier() -> str:
    """
    RFC 7636 code verifier: 43-128 URL-safe characters.
    """
    return secrets.token_urlsafe(64)  # 86 URL-safe characters


def _generate_code_challenge(verifier: str) -> str:
    """
    S256 code challenge = BASE64URL(SHA256(ASCII(code_verifier)))
    """
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


# ---------------------------------------------------------------------------
# OIDC discovery cache
# ---------------------------------------------------------------------------
_oidc_config: dict | None = None
_jwks_client: jwt.PyJWKClient | None = None


def _get_oidc_config() -> dict:
    global _oidc_config
    if _oidc_config is None:
        resp = requests.get(OAUTH_CONFIG["discovery_url"], timeout=10)
        resp.raise_for_status()
        _oidc_config = resp.json()
        logger.info("OIDC discovery document loaded.")
    return _oidc_config


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        oidc = _get_oidc_config()
        _jwks_client = jwt.PyJWKClient(oidc["jwks_uri"], cache_keys=True)
    return _jwks_client


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------

def _create_state() -> str:
    """
    Generate a cryptographically random state value and store it
    server-side so we can verify it on return.
    """
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    code_verifier = _generate_code_verifier()

    _pending_states[state] = {
        "nonce": nonce,
        "code_verifier": code_verifier,
        "created_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    # Also store in the session as an extra binding to this browser
    session["oauth_state"] = state
    return state


def _consume_state(state: str) -> dict:
    """
    Validate and consume a state value.
    Raises ValueError on invalid/expired/replayed state.
    """
    if not state:
        raise ValueError("Missing state parameter.")

    # Session binding check
    session_state = session.pop("oauth_state", None)
    if not secrets.compare_digest(str(session_state), str(state)):
        raise ValueError("State does not match session binding (possible CSRF).")

    entry = _pending_states.pop(state, None)
    if entry is None:
        raise ValueError("Unknown or already-used state (possible replay).")

    # Optional: check age (10-minute window)
    created = datetime.fromisoformat(entry["created_at"])
    age = (datetime.now(tz=timezone.utc) - created).total_seconds()
    if age > 600:
        raise ValueError("State has expired.")

    return entry  # contains nonce + code_verifier


# ---------------------------------------------------------------------------
# Token exchange (server-side – client secret never touches the browser)
# ---------------------------------------------------------------------------

def _exchange_code_for_tokens(code: str, code_verifier: str) -> dict:
    """
    POST to the provider's token endpoint with the authorisation code.
    The client_secret is added here on the server; it is never sent to or
    returned to the browser.
    """
    oidc = _get_oidc_config()
    token_url = oidc["token_endpoint"]

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": OAUTH_CONFIG["redirect_uri"],
        "client_id": OAUTH_CONFIG["client_id"],
        "client_secret": OAUTH_CONFIG["client_secret"],  # server-side only
        "code_verifier": code_verifier,  # PKCE
    }

    resp = requests.post(token_url, data=payload, timeout=15)
    resp.raise_for_status()
    tokens = resp.json()

    if "error" in tokens:
        raise ValueError(f"Token endpoint error: {tokens['error']} – {tokens.get('error_description', '')}")

    return tokens  # contains access_token, id_token, token_type, expires_in, …


# ---------------------------------------------------------------------------
# ID token validation
# ---------------------------------------------------------------------------

def _validate_id_token(id_token: str, nonce: str) -> dict:
    """
    Validate the id_token JWT:
      1. Signature against provider's JWKS
      2. iss claim
      3. aud claim
      4. exp / iat (handled by PyJWT)
      5. nonce (replay prevention)
    Returns the decoded payload on success.
    """
    jwks_client = _get_jwks_client()

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
    except jwt.exceptions.PyJWKClientError as exc:
        raise ValueError(f"Cannot find signing key: {exc}") from exc

    try:
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256", "ES256"],