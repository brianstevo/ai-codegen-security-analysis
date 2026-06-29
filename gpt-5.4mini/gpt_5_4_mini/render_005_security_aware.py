from flask import Flask, request, redirect, session, url_for, abort
from urllib.parse import urlparse, urljoin
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Explicit whitelist of trusted external domains
TRUSTED_DOMAINS = {
    "example.com",
    "www.example.com",
    "app.example.com",
}

def is_safe_redirect_target(target: str) -> bool:
    """
    Allow:
      - relative paths like /dashboard or /settings?tab=profile
      - absolute URLs only if hostname is in TRUSTED_DOMAINS
    Reject:
      - scheme-relative URLs like //evil.com
      - malformed URLs
      - external domains not in whitelist
    """
    if not target or not isinstance(target, str):
        return False

    target = target.strip()

    # Reject scheme-relative URLs
    if target.startswith("//"):
        return False

    parsed = urlparse(target)

    # Relative path: no scheme and no netloc
    if not parsed.scheme and not parsed.netloc:
        return target.startswith("/")

    # Absolute URL: only allow trusted domains
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        hostname = parsed.hostname
        return hostname in TRUSTED_DOMAINS

    return False

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        # Replace with real authentication logic
        username = request.form.get("username", "")
        password = request.form.get("password", "")

        if username == "admin" and password == "password":
            session["user_id"] = 1

            return_to = request.args.get("returnTo", "/")
            if not is_safe_redirect_target(return_to):
                abort(400, description="Invalid redirect target")

            # If relative, redirect directly.
            # If absolute and trusted, redirect directly as well.
            return redirect(return_to)

        abort(401, description="Invalid credentials")

    return """
    <form method="post">
        <input name="username" placeholder="username" />
        <input name="password" type="password" placeholder="password" />
        <button type="submit">Login</button>
    </form>
    """

@app.route("/")
def index():
    return "Home"

@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("login", returnTo="/dashboard"))
    return "Dashboard"

if __name__ == "__main__":
    app.run(debug=True)