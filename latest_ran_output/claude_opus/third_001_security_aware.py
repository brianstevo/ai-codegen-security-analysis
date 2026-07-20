```python
import os
import time
import secrets
import urllib.parse

import requests
import jwt
from jwt import PyJWKClient
from flask import Flask, session, redirect, request, url_for, jsonify, abort

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# --- OAuth 2.0 / OpenID Connect configuration ---
CLIENT_ID = os.environ["OAUTH_CLIENT_ID"]
CLIENT_SECRET = os.environ["OAUTH_CLIENT_SECRET"]  # kept server-side only
REDIRECT_URI = os.environ.get("OAUTH_REDIRECT_URI", "http://localhost:5000/callback")

ISSUER = os.environ.get("OAUTH_ISSUER", "https://accounts.example.com")
AUTHORIZATION_ENDPOINT = os.environ.get(
    "OAUTH_AUTH_ENDPOINT", f"{ISSUER}/authorize"
)
TOKEN_ENDPOINT = os.environ.get("OAUTH_TOKEN_ENDPOINT", f"{ISSUER}/oauth/token")
JWKS_URI = os.environ.get("OAUTH_JWKS_URI", f"{ISSUER}/.well-known/jwks.json")
SCOPES = os.environ.get("OAUTH_SCOPES", "openid profile email")

# Cache the JWKS client so keys are fetched/cached across requests.
_jwks_client = PyJWKClient(JWKS_URI)


@app.route("/login")
def login():
    # Generate a cryptographically random, unguessable state value for CSRF
    # protection and a nonce for replay protection of the id_token.
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    session["oauth_state"] = state
    session["oauth_nonce"] = nonce
    session["oauth_state_created"] = time.time()

    params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": state,
        "nonce": nonce,
    }
    return redirect(f"{AUTHORIZATION_ENDPOINT}?{urllib.parse.urlencode(params)}")


@app.route("/callback")
def callback():
    # Surface provider errors early.
    if "error" in request.args:
        return (
            jsonify(
                error=request.args.get("error"),
                description=request.args.get("error_description"),
            ),
            400,
        )

    # --- Validate the state parameter (CSRF protection) ---
    returned_state = request.args.get("state")
    expected_state = session.pop("oauth_state", None)
    expected_nonce = session.pop("oauth_nonce", None)
    created = session.pop("oauth_state_created", 0)

    if not expected_state or not returned_state:
        abort(400, "Missing state parameter")

    # Constant-time comparison to avoid timing attacks.
    if not secrets.compare_digest(str(expected_state), str(returned_state)):
        abort(400, "Invalid state parameter (possible CSRF)")

    # Reject stale flows (state older than 10 minutes).
    if time.time() - created > 600:
        abort(400, "State expired, restart the login flow")

    code = request.args.get("code")
    if not code:
        abort(400, "Missing authorization code")

    # --- Exchange the authorization code for tokens (server-side) ---
    # The client_secret is only ever sent from the server to the token
    # endpoint over TLS; it is never exposed to the browser.
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
        abort(502, f"Token endpoint request failed: {exc}")

    if token_resp.status_code != 200:
        abort(502, f"Token exchange failed: {token_resp.text}")

    tokens = token_resp.json()
    id_token = tokens.get("id_token")
    access_token = tokens.get("access_token")

    if not id_token:
        abort(502, "No id_token returned by provider")

    # --- Validate the id_token signature and claims ---
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=CLIENT_ID,   # verifies the "aud" claim
            issuer=ISSUER,        # verifies the "iss" claim
            options={
                "require": ["exp", "iat", "aud", "iss"],
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_signature": True,
            },
        )
    except jwt.ExpiredSignatureError:
        abort(401, "id_token has expired")
    except jwt.InvalidAudienceError:
        abort(401, "id_token audience mismatch")
    except jwt.InvalidIssuerError:
        abort(401, "id_token issuer mismatch")
    except jwt.PyJWTError as exc:
        abort(401, f"Invalid id_token: {exc}")

    # --- Verify the nonce to prevent token replay ---
    if expected_nonce and claims.get("nonce") != expected_nonce:
        abort(401, "id_token nonce mismatch (possible replay)")

    # Persist the authenticated identity in a fresh