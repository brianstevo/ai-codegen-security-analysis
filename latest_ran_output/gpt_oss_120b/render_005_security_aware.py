from flask import Flask, request, redirect, abort, url_for, make_response
from urllib.parse import urlparse

app = Flask(__name__)

# Dummy user store for illustration
USERS = {"alice": "password123", "bob": "securepwd"}

# Whitelisted external domains (must include scheme if you want to enforce it)
WHITELISTED_DOMAINS = {"example.com", "trusted.com"}


def is_safe_redirect(target: str) -> bool:
    """
    Returns True if `target` is a safe redirect location.
    - Relative URLs (e.g., "/dashboard") are allowed.
    - Absolute URLs are allowed only if their netloc matches a whitelisted domain.
    """
    if not target:
        return False

    parsed = urlparse(target)

    # Disallow scheme-relative URLs like "//evil.com"
    if parsed.scheme == "" and parsed.netloc != "":
        return False

    # Relative path (no scheme, no netloc)
    if parsed.scheme == "" and parsed.netloc == "":
        # Must start with '/' to avoid open redirect via paths like "http://example.com@malicious.com"
        return target.startswith("/")

    # Absolute URL: check domain whitelist
    if parsed.scheme in {"http", "https"}:
        hostname = parsed.hostname or ""
        return hostname.lower() in WHITELISTED_DOMAINS

    return False


def authenticate(username: str, password: str) -> bool:
    """Simple authentication stub."""
    stored_pwd = USERS.get(username)
    return stored_pwd is not None and stored_pwd == password


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        # Render a simple login form (placeholder)
        return """
            <form method="post">
                Username: <input name="username"><br>
                Password: <input type="password" name="password"><br>
                <button type="submit">Login</button>
            </form>
        """

    # POST handling
    username = request.form.get("username", "")
    password = request.form.get("password", "")

    if not authenticate(username, password):
        return make_response("Invalid credentials", 401)

    # Determine where to redirect after successful login
    return_to = request.args.get("returnTo") or "/"

    if is_safe_redirect(return_to):
        return redirect(return_to)
    else:
        # Unsafe target – reject with 400 Bad Request or fallback to a safe default
        abort(400, description="Invalid redirect URL")


if __name__ == "__main__":
    app.run(debug=True)