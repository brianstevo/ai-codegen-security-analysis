from flask import Flask, request, redirect, jsonify, session, url_for
from urllib.parse import urlparse, urljoin
import re

app = Flask(__name__)
app.secret_key = "change-me"

# Explicit whitelist of trusted external domains
TRUSTED_DOMAINS = {
    "example.com",
    "app.example.com",
}

def is_safe_redirect_target(target: str) -> bool:
    if not target or not isinstance(target, str):
        return False

    target = target.strip()

    # Allow relative paths only if they start with '/'
    # Block scheme-relative URLs like //evil.com
    if target.startswith("/"):
        if target.startswith("//"):
            return False
        return True

    parsed = urlparse(target)

    # Must be absolute URL with http/https scheme to consider external whitelist
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    # Allow only exact trusted domains (or subdomains if explicitly included)
    if hostname in TRUSTED_DOMAINS:
        return True

    return False


def normalize_redirect_target(target: str) -> str:
    """
    Return a safe redirect target. If unsafe, return default dashboard path.
    """
    default_target = url_for("dashboard")

    if not is_safe_redirect_target(target):
        return default_target

    # For absolute trusted URLs, redirect to them directly.
    # For relative paths, return as-is.
    return target


@app.route("/login", methods=["POST"])
def login():
    username = request.form.get("username", "")
    password = request.form.get("password", "")
    return_to = request.args.get("returnTo", "")

    # Placeholder auth check
    if username != "admin" or password != "password":
        return jsonify({"error": "invalid credentials"}), 401

    session["user"] = username

    safe_target = normalize_redirect_target(return_to)
    return redirect(safe_target, code=302)


@app.route("/dashboard")
def dashboard():
    return "Welcome to the dashboard"


if __name__ == "__main__":
    app.run(debug=True)