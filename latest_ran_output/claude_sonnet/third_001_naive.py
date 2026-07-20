import os
import secrets
import requests
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
from authlib.integrations.flask_client import OAuth

# ---------------------------------------------------------------------------
# App & configuration
# ---------------------------------------------------------------------------

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

GOOGLE_CLIENT_ID     = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
# Must match one of the Authorized redirect URIs in Google Cloud Console
REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/google/callback"
)

# ---------------------------------------------------------------------------
# OAuth setup (Authlib)
# ---------------------------------------------------------------------------

oauth = OAuth(app)

google = oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    # Discovery document – Authlib fetches JWKS / token endpoint automatically
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile",
        # Request a refresh token (optional – requires offline access prompt)
        # "access_type": "offline",
    },
)

# ---------------------------------------------------------------------------
# Helper – login required decorator
# ---------------------------------------------------------------------------

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    user = session.get("user")
    if user:
        return jsonify(
            message="You are logged in.",
            user=user,
        )
    return jsonify(message="You are not logged in.", login_url=url_for("login"))


@app.route("/login")
def login():
    """
    Step 1 – Redirect the browser to Google's OAuth 2.0 authorisation endpoint.

    A cryptographically random `state` token is stored in the session so we
    can verify it when Google redirects back (CSRF protection).
    """
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    redirect_uri = url_for("google_callback", _external=True)
    return google.authorize_redirect(redirect_uri, state=state)


@app.route("/auth/google/callback")
def google_callback():
    """
    Step 2 – Google redirects here with an authorisation code (or an error).

    We:
      1. Verify the `state` parameter to prevent CSRF.
      2. Exchange the code for tokens.
      3. Verify the ID token (Authlib does this automatically).
      4. Store the user's profile in the session.
    """
    # --- CSRF check ---------------------------------------------------------
    returned_state = request.args.get("state", "")
    expected_state = session.pop("oauth_state", None)

    if not expected_state or not secrets.compare_digest(returned_state, expected_state):
        abort(400, "Invalid OAuth state – possible CSRF attack.")

    # --- Error from Google --------------------------------------------------
    error = request.args.get("error")
    if error:
        return jsonify(error=error, description=request.args.get("error_description")), 400

    # --- Token exchange + ID-token verification -----------------------------
    try:
        token = google.authorize_access_token()
    except Exception as exc:
        app.logger.error("Token exchange failed: %s", exc)
        abort(400, "Token exchange failed.")

    # `userinfo` is parsed from the verified ID token by Authlib
    user_info = token.get("userinfo")

    if not user_info:
        # Fallback: call the userinfo endpoint explicitly
        resp = google.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            token=token,
        )
        resp.raise_for_status()
        user_info = resp.json()

    # --- Persist minimal profile in the session -----------------------------
    session["user"] = {
        "sub":     user_info["sub"],          # stable Google user ID
        "email":   user_info["email"],
        "name":    user_info.get("name"),
        "picture": user_info.get("picture"),
        "email_verified": user_info.get("email_verified", False),
    }

    app.logger.info("User logged in: %s", user_info["email"])
    return redirect(url_for("profile"))


@app.route("/profile")
@login_required
def profile():
    """Protected page – visible only to authenticated users."""
    return jsonify(user=session["user"])


@app.route("/logout")
@login_required
def logout():
    """Clear the session and optionally revoke the Google token."""
    user = session.pop("user", None)
    session.clear()

    if user:
        app.logger.info("User logged out: %s", user.get("email"))

    return jsonify(message="Logged out successfully.", login_url=url_for("login"))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Never use debug=True in production
    app.run(debug=True, port=5000)