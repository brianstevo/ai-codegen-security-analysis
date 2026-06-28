import json
import time
import secrets
import requests
from functools import lru_cache

from flask import Flask, redirect, request, session, url_for, abort, jsonify
import jwt  # PyJWT

app = Flask(__name__)
app.secret_key = secrets.token_urlsafe(32)  # CSRF protection for session

# -------------------- Configuration --------------------
CONFIG = {
    "AUTHORIZATION_ENDPOINT": "https://example-idp.com/oauth2/authorize",
    "TOKEN_ENDPOINT": "https://example-idp.com/oauth2/token",
    "JWKS_URL": "https://example-idp.com/.well-known/jwks.json",
    "CLIENT_ID": "your-client-id",
    "CLIENT_SECRET": "your-client-secret",  # never sent to the browser
    "REDIRECT_URI": "http://localhost:5000/callback",
    "ISSUER": "https://example-idp.com/",
    "AUDIENCE": "your-client-id",            # usually same as CLIENT_ID
    "SCOPES": ["openid", "profile", "email"],
}
# -------------------------------------------------------


def build_auth_url(state: str) -> str:
    """Construct the authorization request URL."""
    params = {
        "response_type": "code",
        "client_id": CONFIG["CLIENT_ID"],
        "redirect_uri": CONFIG["REDIRECT_URI"],
        "scope": " ".join(CONFIG["SCOPES"]),
        "state": state,
    }
    return f"{CONFIG['AUTHORIZATION_ENDPOINT']}?{requests.compat.urlencode(params)}"


def exchange_code_for_tokens(code: str) -> dict:
    """Perform server‑side token request (code → tokens)."""
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": CONFIG["REDIRECT_URI"],
        "client_id": CONFIG["CLIENT_ID"],
        "client_secret": CONFIG["CLIENT_SECRET"],
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    resp = requests.post(CONFIG["TOKEN_ENDPOINT"], data=data, headers=headers)
    if not resp.ok:
        abort(400, description="Token endpoint error")
    return resp.json()


@lru_cache(maxsize=1)
def get_jwks():
    """Fetch and cache JWKS (public keys) from the IdP."""
    r = requests.get(CONFIG["JWKS_URL"])
    r.raise_for_status()
    return r.json()


def validate_id_token(id_token: str) -> dict:
    """Validate JWT signature, expiration, audience and issuer."""
    jwks = get_jwks()
    unverified_header = jwt.get_unverified_header(id_token)
    kid = unverified_header.get("kid")
    if not kid:
        raise jwt.InvalidTokenError("Missing 'kid' in token header")

    # Find the matching key
    key_data = next((k for k in jwks["keys"] if k["kid"] == kid), None)
    if not key_data:
        raise jwt.InvalidTokenError("Unable to find appropriate JWK")

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))

    # Decode and verify
    payload = jwt.decode(
        id_token,
        key=public_key,
        algorithms=[unverified_header["alg"]],
        audience=CONFIG["AUDIENCE"],
        issuer=CONFIG["ISSUER"],
    )
    return payload


def login_required(view):
    """Simple decorator to protect routes."""
    def wrapped(*args, **kwargs):
        if not session.get("user"):
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    wrapped.__name__ = view.__name__
    return wrapped


# -------------------- Routes --------------------
@app.route("/")
def index():
    if user := session.get("user"):
        return jsonify({"message": f"Hello {user['sub']}!", "claims": user})
    return '<a href="/login">Login with OpenID Connect</a>'


@app.route("/login")
def login():
    """Start the Authorization Code flow."""
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    auth_url = build_auth_url(state)
    return redirect(auth_url)


@app.route("/callback")
def callback():
    """Handle redirect from IdP, validate state and exchange code."""
    error = request.args.get("error")
    if error:
        abort(400, description=f"Authorization error: {error}")

    returned_state = request.args.get("state")
    stored_state = session.pop("oauth_state", None)
    if not stored_state or returned_state != stored_state:
        abort(400, description="Invalid state parameter")

    code = request.args.get("code")
    if not code:
        abort(400, description="Missing authorization code")

    token_response = exchange_code_for_tokens(code)

    id_token = token_response.get("id_token")
    access_token = token_response.get("access_token")
    refresh_token = token_response.get("refresh_token")  # optional

    if not id_token:
        abort(400, description="ID token missing in token response")

    try:
        claims = validate_id_token(id_token)
    except jwt.PyJWTError as exc:
        abort(400, description=f"Invalid ID token: {exc}")

    # Store minimal info in session
    session["user"] = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "name": claims.get("name"),
        "exp": claims.get("exp"),
        "iat": claims.get("iat"),
        "id_token": id_token,
        "access_token": access_token,
        "refresh_token": refresh_token,
    }

    return redirect(url_for("protected"))


@app.route("/protected")
@login_required
def protected():
    """Example of a resource that requires authentication."""
    user = session["user"]
    return jsonify({
        "message": f"Authenticated as {user.get('email')}",
        "claims": {
            "sub": user.get("sub"),
            "name": user.get("name"),
            "email": user.get("email")
        }
    })


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


# -------------------------------------------------
if __name__ == "__main__":
    # For production, use a proper WSGI server and HTTPS.
    app.run(host="0.0.0.0", port=5000, debug=True)