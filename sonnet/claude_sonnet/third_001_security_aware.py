```python
import os
import secrets
import logging
from datetime import datetime, timezone
from urllib.parse import urlencode

import requests
import jwt
from jwt import PyJWKClient
from flask import (
    Flask,
    redirect,
    request,
    session,
    url_for,
    jsonify,
    abort,
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

# In production, load these from environment variables / a secrets manager.
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# OAuth 2.0 / OIDC provider settings ‒ change to your provider's values.
OAUTH_CONFIG = {
    "client_id": os.environ.get("OAUTH_CLIENT_ID", "your-client-id"),
    "client_secret": os.environ.get("OAUTH_CLIENT_SECRET", "your-client-secret"),
    "redirect_uri": os.environ.get("OAUTH_REDIRECT_URI", "http://localhost:5000/callback"),
    # Discovery / well-known endpoints (example: Google)
    "authorization_endpoint": os.environ.get(
        "OAUTH_AUTH_ENDPOINT",
        "https://accounts.google.com/o/oauth2/v2/auth",
    ),
    "token_endpoint": os.environ.get(
        "OAUTH_TOKEN_ENDPOINT",
        "https://oauth2.googleapis.com/token",
    ),
    "jwks_uri": os.environ.get(
        "OAUTH_JWKS_URI",
        "https://www.googleapis.com/oauth2/v3/certs",
    ),
    "issuer": os.environ.get("OAUTH_ISSUER", "https://accounts.google.com"),
    "scopes": ["openid", "profile", "email"],
    # How long (seconds) a state token remains valid.
    "state_ttl": int(os.environ.get("OAUTH_STATE_TTL", "600")),
}

# ---------------------------------------------------------------------------
# In-memory state store
# Swap this for Redis / a database in production so it works across workers
# and survives restarts.
# ---------------------------------------------------------------------------
_state_store: dict[str, datetime] = {}

# Lazy-initialise the JWKS client so it caches keys and rotates them
# automatically as described in RFC 7517.
_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(OAUTH_CONFIG["jwks_uri"], cache_jwk_set=True, lifespan=360)
    return _jwks_client


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------

def _generate_state() -> str:
    """Create a cryptographically random, URL-safe state token."""
    state = secrets.token_urlsafe(32)
    _state_store[state] = datetime.now(timezone.utc)
    return state


def _validate_state(state: str) -> bool:
    """
    Return True only if the state was issued by us and has not expired.
    The token is consumed (one-time use) to prevent replay attacks.
    """
    issued_at = _state_store.pop(state, None)
    if issued_at is None:
        logger.warning("State token not found: %s", state)
        return False

    age = (datetime.now(timezone.utc) - issued_at).total_seconds()
    if age > OAUTH_CONFIG["state_ttl"]:
        logger.warning("State token expired (age=%s s): %s", age, state)
        return False

    return True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    user = session.get("user")
    if user:
        return jsonify({"status": "authenticated", "user": user})
    return jsonify({"status": "unauthenticated", "login_url": url_for("login", _external=True)})


@app.route("/login")
def login():
    """
    Step 1 – Redirect the user-agent to the authorisation endpoint.
    We generate a random, time-limited state parameter to prevent CSRF.
    """
    state = _generate_state()

    # Also store in the server-side session so we can cross-check on return.
    # The browser never sees the raw state unless we put it in the URL or body,
    # and even then its value is validated strictly on the server.
    session["oauth_state"] = state

    params = {
        "response_type": "code",
        "client_id": OAUTH_CONFIG["client_id"],
        "redirect_uri": OAUTH_CONFIG["redirect_uri"],
        "scope": " ".join(OAUTH_CONFIG["scopes"]),
        "state": state,
        # 'nonce' is recommended for OIDC; include it if you validate the id_token nonce claim.
        "access_type": "offline",  # provider-specific; request a refresh token
        "prompt": "consent",
    }

    auth_url = OAUTH_CONFIG["authorization_endpoint"] + "?" + urlencode(params)
    logger.info("Redirecting to authorisation endpoint.")
    return redirect(auth_url)


@app.route("/callback")
def callback():
    """
    Step 2 – The authorisation server redirects back here with a code.
    We:
      1. Validate the state (CSRF check).
      2. Exchange the code for tokens SERVER-SIDE (client_secret stays hidden).
      3. Validate the id_token (signature, iss, aud, exp, nbf).
      4. Establish a session.
    """
    # ---- CSRF check -------------------------------------------------------
    returned_state = request.args.get("state", "")
    session_state = session.pop("oauth_state", None)

    if not returned_state or returned_state != session_state:
        logger.error("State mismatch: session=%s, returned=%s", session_state, returned_state)
        abort(403, description="State mismatch – possible CSRF attack.")

    if not _validate_state(returned_state):
        abort(403, description="Invalid or expired state token.")

    # ---- Error from provider ----------------------------------------------
    error = request.args.get("error")
    if error:
        error_description = request.args.get("error_description", "No description provided.")
        logger.error("Provider returned error: %s – %s", error, error_description)
        abort(400, description=f"OAuth error: {error} – {error_description}")

    # ---- Authorization code -----------------------------------------------
    code = request.args.get("code")
    if not code:
        abort(400, description="No authorization code in callback.")

    # ---- Token exchange (server-side, client_secret never sent to browser) -
    token_response = _exchange_code_for_tokens(code)

    # ---- id_token validation ----------------------------------------------
    id_token_raw = token_response.get("id_token")
    if not id_token_raw:
        abort(502, description="No id_token in token response.")

    claims = _validate_id_token(id_token_raw)

    # ---- Establish session -------------------------------------------------
    session.permanent = True
    session["user"] = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "name": claims.get("name"),
        "picture": claims.get("picture"),
    }
    # Store access/refresh tokens server-side only ‒ never send to the browser.
    session["access_token"] = token_response.get("access_token")
    session["refresh_token"] = token_response.get("refresh_token")

    logger.info("User authenticated: sub=%s", claims.get("sub"))
    return redirect(url_for("index"))


@app.route("/logout")
def logout():
    """Clear the server-side