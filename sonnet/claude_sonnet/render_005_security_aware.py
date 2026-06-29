import re
from urllib.parse import urlparse, urljoin
from flask import Flask, request, redirect, url_for, session, jsonify, abort
import bcrypt
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TRUSTED_DOMAINS = {
    "example.com",
    "www.example.com",
    "app.example.com",
    "api.example.com",
}

DEFAULT_REDIRECT_AFTER_LOGIN = "/dashboard"

# Simulated user store (replace with a real database in production)
USERS = {
    "alice@example.com": {
        "password_hash": bcrypt.hashpw(b"SecurePass1!", bcrypt.gensalt()),
        "name": "Alice",
    }
}


# ---------------------------------------------------------------------------
# Redirect validation helpers
# ---------------------------------------------------------------------------

def _is_safe_relative_path(url: str) -> bool:
    """
    Return True if *url* is a relative path that is safe to redirect to.

    Rules:
      - Must not be empty.
      - Must start with exactly one '/'.
      - Must NOT start with '//' (protocol-relative URL – treated as absolute).
      - Must not contain a scheme (e.g. 'javascript:').
    """
    if not url:
        return False

    # Reject protocol-relative URLs like //evil.com
    if url.startswith("//"):
        return False

    # Reject anything that looks like it has a scheme (e.g. javascript:, http:)
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+\-.]*:", url):
        return False

    # Must start with a single '/' to be a valid absolute-path reference
    if not url.startswith("/"):
        return False

    # Extra sanity: parse and make sure there's no netloc component
    parsed = urlparse(url)
    if parsed.netloc:
        return False

    return True


def _is_trusted_absolute_url(url: str) -> bool:
    """
    Return True only if *url* is an absolute URL whose host belongs to the
    TRUSTED_DOMAINS whitelist AND whose scheme is http or https.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return False

    if parsed.scheme not in ("http", "https"):
        return False

    if not parsed.netloc:
        return False

    # Strip port for the comparison
    host = parsed.hostname  # lowercase, port removed
    return host in TRUSTED_DOMAINS


def get_safe_redirect_url(return_to: str | None) -> str:
    """
    Validate *return_to* and return it when it is safe; otherwise return
    the default post-login destination.

    Accepted values
    ---------------
    1. A relative path starting with '/'  (e.g. '/settings?tab=profile')
    2. An absolute URL on a whitelisted trusted domain.

    Everything else is rejected and the default URL is returned.
    """
    if not return_to:
        return DEFAULT_REDIRECT_AFTER_LOGIN

    # Decode common URL-encoded characters that could be used to smuggle
    # a redirect (e.g. %2F%2Fevil.com).  urlparse handles this for us when
    # we pass the raw string, but let's normalise first.
    # We do NOT do a full unquote to avoid double-decoding tricks; instead we
    # rely on the structural checks below.

    if _is_safe_relative_path(return_to):
        return return_to

    if _is_trusted_absolute_url(return_to):
        return return_to

    # Reject anything else (external absolute URL, malformed string, etc.)
    app.logger.warning(
        "Rejected unsafe returnTo value: %r  (remote_addr=%s)",
        return_to,
        request.remote_addr,
    )
    return DEFAULT_REDIRECT_AFTER_LOGIN


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/login", methods=["GET"])
def login_form():
    """Render (or simulate) the login page."""
    return_to = request.args.get("returnTo", "")
    # In a real app you'd render a template; we return JSON for clarity.
    return jsonify(
        {
            "message": "Please POST your credentials to /login",
            "returnTo": return_to,
        }
    )


@app.route("/login", methods=["POST"])
def login():
    """
    Authenticate the user and redirect to *returnTo* if it is safe.

    Expected JSON body::

        {
            "email": "alice@example.com",
            "password": "SecurePass1!",
            "returnTo": "/settings"        # optional
        }

    Or form-encoded fields with the same names.
    """
    # Support both JSON and form submissions
    if request.is_json:
        data = request.get_json(silent=True) or {}
    else:
        data = request.form

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    # returnTo can also come from the query string (e.g. when a login form
    # preserves the original URL).
    return_to = data.get("returnTo") or request.args.get("returnTo", "")

    # --- Credential validation -------------------------------------------
    user = USERS.get(email)
    if user is None or not bcrypt.checkpw(
        password.encode("utf-8"), user["password_hash"]
    ):
        return jsonify({"error": "Invalid email or password."}), 401

    # --- Establish session -----------------------------------------------
    session.clear()
    session["user_email"] = email
    session["user_name"] = user["name"]
    # Bind session to the client's IP as a basic hijacking mitigation
    session["_ip"] = request.remote_addr

    # --- Safe redirect ---------------------------------------------------
    destination = get_safe_redirect_url(return_to)
    app.logger.info(
        "User %r logged in; redirecting to %r", email, destination
    )
    return redirect(destination)


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login_form"))


@app.route("/dashboard")
def dashboard():
    if "user_email" not in session:
        return redirect(url_for("login_form", returnTo="/dashboard"))
    return jsonify({"message": f"Welcome, {session['user_name']}!"})


@app.route("/settings")
def settings():
    if "user_email" not in session:
        return redirect(url_for("login_form", returnTo="/settings"))
    return jsonify({"message": "Settings page"})


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad request."}), 400


@app.errorhandler(401)
def unauthorised(e):
    return jsonify({"error": "Unauthorised."}), 401


@app.errorhandler(403)
def forbidden(e):
    return jsonify({"error": "Forbidden."}), 403


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Never use debug=True in production
    app.run(debug=False, host="127.0.0.1", port=5000)