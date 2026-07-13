import os
import secrets
import json
from functools import wraps
from flask import (
    Flask,
    redirect,
    url_for,
    session,
    request,
    jsonify,
    abort,
)
import requests
from authlib.integrations.flask_client import OAuth

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# ── OAuth configuration ────────────────────────────────────────────────────────
oauth = OAuth(app)

google = oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile",
        # Request offline access if you need a refresh token
        # "access_type": "offline",
    },
)

# ── Helpers ────────────────────────────────────────────────────────────────────

def login_required(f):
    """Decorator that protects routes requiring an authenticated session."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated


def _validate_state(received: str, stored: str) -> bool:
    """Constant-time comparison to prevent timing attacks on the CSRF token."""
    return secrets.compare_digest(received, stored)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    user = session.get("user")
    if user:
        return jsonify(
            {
                "message": "You are logged in",
                "user": user,
            }
        )
    return jsonify({"message": "You are not logged in", "login_url": url_for("login", _external=True)})


@app.route("/login")
def login():
    """
    Redirect the browser to Google's authorisation endpoint.

    A random *state* parameter is stored in the server-side session to
    protect against CSRF / open-redirect attacks.
    """
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    redirect_uri = url_for("authorized", _external=True)
    return google.authorize_redirect(redirect_uri, state=state)


@app.route("/login/callback")
def authorized():
    """
    Google redirects the user back here after they approve (or deny) access.

    Steps
    -----
    1. Validate the *state* parameter (CSRF protection).
    2. Exchange the authorisation code for tokens.
    3. Verify the ID-token and extract the user's profile.
    4. Persist the profile in the server-side session.
    """
    # ── 1. CSRF / state validation ─────────────────────────────────────────
    received_state = request.args.get("state", "")
    stored_state   = session.pop("oauth_state", "")

    if not stored_state or not _validate_state(received_state, stored_state):
        abort(400, description="Invalid state parameter – possible CSRF attack.")

    # ── Check for OAuth errors returned by Google ──────────────────────────
    error = request.args.get("error")
    if error:
        return jsonify({"error": error, "description": request.args.get("error_description")}), 400

    # ── 2 & 3. Exchange code → tokens → verify ID token ───────────────────
    try:
        token = google.authorize_access_token()
    except Exception as exc:
        return jsonify({"error": "Token exchange failed", "detail": str(exc)}), 400

    # Authlib automatically validates the ID token's signature, expiry, and
    # audience when you call authorize_access_token() with openid in scope.
    user_info = token.get("userinfo")

    if not user_info:
        # Fallback: fetch from Google's UserInfo endpoint
        resp = google.get("https://openidconnect.googleapis.com/v1/userinfo", token=token)
        resp.raise_for_status()
        user_info = resp.json()

    # ── 4. Store a safe subset in the session ──────────────────────────────
    session["user"] = {
        "sub":            user_info.get("sub"),          # Google user ID
        "email":          user_info.get("email"),
        "email_verified": user_info.get("email_verified"),
        "name":           user_info.get("name"),
        "picture":        user_info.get("picture"),
        "given_name":     user_info.get("given_name"),
        "family_name":    user_info.get("family_name"),
    }

    # Optionally store the access token if you need to call Google APIs later.
    # Never expose access/refresh tokens to the client.
    session["access_token"] = token.get("access_token")

    return redirect(url_for("profile"))


@app.route("/profile")
@login_required
def profile():
    """Return the authenticated user's profile."""
    return jsonify({"user": session["user"]})


@app.route("/logout")
@login_required
def logout():
    """Clear the server-side session and optionally revoke the token."""
    access_token = session.pop("access_token", None)

    # Revoke the token so it can no longer be used even if intercepted.
    if access_token:
        try:
            requests.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": access_token},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=5,
            )
        except requests.RequestException:
            pass  # Best-effort revocation; clear the session regardless.

    session.clear()
    return jsonify({"message": "Logged out successfully"})


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # In production use a proper WSGI server (gunicorn / uWSGI) and set
    # SESSION_COOKIE_SECURE = True, SESSION_COOKIE_HTTPONLY = True, and
    # SESSION_COOKIE_SAMESITE = "Lax" in your Flask config.
    app.config.update(
        SESSION_COOKIE_SECURE=False,   # Set True when serving over HTTPS
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    app.run(debug=True, port=5000)