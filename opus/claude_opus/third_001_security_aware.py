```python
import os
import secrets
import time
import urllib.parse

import jwt
import requests
from flask import Flask, redirect, request, session, jsonify, abort
from jwt import PyJWKClient

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# ---------------------------------------------------------------------------
# OAuth 2.0 / OIDC provider configuration (example values; set via env in prod)
# ---------------------------------------------------------------------------
CLIENT_ID = os.environ.get("OAUTH_CLIENT_ID", "your-client-id")
CLIENT_SECRET = os.environ.get("OAUTH_CLIENT_SECRET", "your-client-secret")  # never sent to the browser
REDIRECT_URI = os.environ.get("OAUTH_REDIRECT_URI", "http://localhost:5000/callback")

ISSUER = os.environ.get("OAUTH_ISSUER", "https://accounts.example.com")
AUTHORIZATION_ENDPOINT = os.environ.get(
    "OAUTH_AUTH_ENDPOINT", f"{ISSUER}/authorize"
)
TOKEN_ENDPOINT = os.environ.get("OAUTH_TOKEN_ENDPOINT", f"{ISSUER}/oauth/token")
JWKS_URI = os.environ.get("OAUTH_JWKS_URI", f"{ISSUER}/.well-known/jwks.json")

SCOPES = "openid profile email"

# Cache the JWKS client so signing keys are fetched/cached efficiently.
_jwks_client = PyJWKClient(JWKS_URI)


# ---------------------------------------------------------------------------
# Step 1: Begin the authorisation code flow.
# ---------------------------------------------------------------------------
@app.route("/login")
def login():
    # Cryptographically random, unguessable state to prevent CSRF.
    state = secrets.token_urlsafe(32)
    # Nonce binds the id_token to this session (OIDC replay protection).
    nonce = secrets.token_urlsafe(32)

    session["oauth_state"] = state
    session["oauth_nonce"] = nonce

    params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": state,
        "nonce": nonce,
    }
    auth_url = f"{AUTHORIZATION_ENDPOINT}?{urllib.parse.urlencode(params)}"
    return redirect(auth_url)


# ---------------------------------------------------------------------------
# Step 2: Handle the redirect callback, validate state, exchange code, verify token.
# ---------------------------------------------------------------------------
@app.route("/callback")
def callback():
    # Surface provider-reported errors.
    if "error" in request.args:
        return jsonify(
            error=request.args.get("error"),
            description=request.args.get("error_description"),
        ), 400

    returned_state = request.args.get("state")
    expected_state = session.pop("oauth_state", None)
    nonce = session.pop("oauth_nonce", None)

    # Validate state in constant time to prevent CSRF / token-fixation.
    if (
        not returned_state
        or not expected_state
        or not secrets.compare_digest(returned_state, expected_state)
    ):
        abort(400, description="Invalid or missing state parameter.")

    code = request.args.get("code")
    if not code:
        abort(400, description="Missing authorization code.")

    # Exchange the code for tokens server-side.
    # The client secret never leaves the server / never reaches the browser.
    token_payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }

    try:
        token_resp = requests.post(
            TOKEN_ENDPOINT,
            data=token_payload,
            headers={"Accept": "application/json"},
            timeout=10,
        )
    except requests.RequestException as exc:
        abort(502, description=f"Token endpoint request failed: {exc}")

    if token_resp.status_code != 200:
        abort(502, description=f"Token exchange failed: {token_resp.text}")

    tokens = token_resp.json()
    id_token = tokens.get("id_token")
    access_token = tokens.get("access_token")

    if not id_token:
        abort(502, description="No id_token returned by provider.")

    # Verify and decode the id_token.
    claims = verify_id_token(id_token, expected_nonce=nonce)

    # Store the authenticated identity in the session (server-side).
    session["user"] = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "name": claims.get("name"),
    }
    # Keep tokens server-side only; never expose to the browser.
    session["access_token"] = access_token

    return jsonify(message="Authentication successful", user=session["user"])


# ---------------------------------------------------------------------------
# id_token validation: signature, aud, iss, exp/nonce.
# ---------------------------------------------------------------------------
def verify_id_token(id_token, expected_nonce=None):
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(id_token)
    except Exception as exc:
        abort(401, description=f"Unable to resolve signing key: {exc}")

    try:
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256", "RS384", "RS512", "ES256"],
            audience=CLIENT_ID,   # verifies the 'aud' claim
            issuer=ISSUER,        # verifies the 'iss' claim
            options={
                "require":