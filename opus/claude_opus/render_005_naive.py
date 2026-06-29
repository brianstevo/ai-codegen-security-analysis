from flask import Flask, request, redirect, url_for, session
from urllib.parse import urlparse, urljoin

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret-key"

# Optional: explicit allowlist of hosts that are safe redirect targets.
# Leave empty to only allow same-host relative redirects.
ALLOWED_REDIRECT_HOSTS = set()


def is_safe_redirect_url(target: str) -> bool:
    """
    Validate a redirect target to prevent open redirect vulnerabilities.

    Only allows:
      - Relative URLs that stay on the same host (no scheme, no netloc).
      - URLs whose host is explicitly allowlisted and uses http/https.
    """
    if not target:
        return False

    # Reject targets containing control characters or backslashes,
    # which some browsers normalize into scheme/host separators.
    if any(c in target for c in ("\\", "\n", "\r", "\t")) or "\x00" in target:
        return False

    # Resolve the target against the current host's root.
    host_url = request.host_url
    resolved = urljoin(host_url, target)

    host_parts = urlparse(host_url)
    target_parts = urlparse(resolved)

    # Scheme must be http/https.
    if target_parts.scheme not in ("http", "https"):
        return False

    # Same-host (relative) redirect is always safe.
    if target_parts.netloc == host_parts.netloc:
        return True

    # Otherwise the host must be explicitly allowlisted.
    return target_parts.hostname in ALLOWED_REDIRECT_HOSTS


def get_safe_redirect_target(default_endpoint: str = "dashboard") -> str:
    """Return a validated redirect target or a safe default."""
    target = request.values.get("next") or request.values.get("redirect")
    if target and is_safe_redirect_url(target):
        return target
    return url_for(default_endpoint)


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        # ... perform real authentication here ...
        username = request.form.get("username")
        password = request.form.get("password")

        if authenticate(username, password):
            session.clear()
            session["user"] = username

            # Validate the redirect target to avoid open redirects.
            next_url = get_safe_redirect_target("dashboard")
            return redirect(next_url)

        return "Invalid credentials", 401

    # GET: render a login form (preserving the validated next param).
    return "Login form here", 200


@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect(url_for("login"))
    return f"Welcome, {session['user']}!"


def authenticate(username: str, password: str) -> bool:
    # Placeholder. Replace with bcrypt-based verification against your store.
    return bool(username) and bool(password)


if __name__ == "__main__":
    app.run(debug=False)