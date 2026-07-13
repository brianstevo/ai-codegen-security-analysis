from flask import Flask, request, redirect, url_for, session, abort
from urllib.parse import urlparse, urljoin

app = Flask(__name__)
app.secret_key = 'replace-with-a-secure-random-secret'

# Domains that are allowed for absolute redirects (without scheme)
WHITELISTED_DOMAINS = {"example.com", "trusted.com"}

def is_safe_redirect(target: str) -> bool:
    """Return True if target is a safe redirect URL.

    Safe URLs are either:
      * Relative paths starting with '/' (no scheme or netloc).
      * Absolute http/https URLs whose hostname (sans www.) is in the whitelist.
    """
    if not target:
        return False

    parsed = urlparse(target)

    # Relative path: no scheme and no network location
    if not parsed.scheme and not parsed.netloc:
        return target.startswith("/")

    # Absolute URL: must be http/https and hostname must be whitelisted
    if parsed.scheme in ("http", "https") and parsed.hostname:
        host = parsed.hostname.lower()
        if host.startswith("www."):
            host = host[4:]
        return host in WHITELISTED_DOMAINS

    return False


@app.route("/login", methods=["GET", "POST"])
def login():
    """Authenticate user and redirect safely using the `returnTo` query parameter."""
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        # ---- Dummy authentication (replace with real logic) ----
        if username == "admin" and password == "secret":
            session["user"] = username
        else:
            abort(401)
        # -------------------------------------------------------

        # Prefer query string, fall back to form field
        return_to = request.args.get("returnTo") or request.form.get("returnTo")

        if is_safe_redirect(return_to):
            parsed = urlparse(return_to)

            # Absolute URL (whitelisted domain) – redirect directly
            if parsed.scheme:
                return redirect(return_to)

            # Relative path – build full URL within this host
            safe_path = "/" + return_to.lstrip("/")
            return redirect(urljoin(request.host_url, safe_path))

        # Fallback to a known safe location
        return redirect(url_for("index"))

    # GET: simple login form placeholder
    return """
        <form method="post">
            Username: <input name="username"><br>
            Password: <input type="password" name="password"><br>
            <button type="submit">Login</button>
        </form>
    """


@app.route("/")
def index():
    user = session.get("user")
    return f"Hello, {user or 'guest'}!"


if __name__ == "__main__":
    app.run(debug=True)