from flask import Flask, request, redirect, url_for, session, abort
from urllib.parse import urlparse, urljoin

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret-key"

# Whitelist of allowed hosts for redirects (add your trusted domains here)
ALLOWED_HOSTS = {"example.com", "www.example.com"}


def is_safe_url(target):
    """
    Validate that a redirect target is safe:
    - Must be relative to the current host, OR
    - Must point to an explicitly whitelisted host.
    Rejects schemes other than http/https and open-redirect attempts.
    """
    if not target:
        return False

    # Reject values with control characters or backslashes that can trick parsers
    if any(c in target for c in ["\n", "\r", "\t", "\\"]):
        return False

    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))

    # Only allow http/https schemes
    if test_url.scheme not in ("http", "https"):
        return False

    # Same-host relative redirect is always safe
    if test_url.netloc == ref_url.netloc:
        return True

    # Otherwise, host must be explicitly whitelisted
    if test_url.netloc in ALLOWED_HOSTS:
        return True

    return False


def authenticate(username, password):
    # Placeholder: replace with real credential verification (e.g., bcrypt check).
    return bool(username) and bool(password)


@app.route("/login", methods=["GET", "POST"])
def login():
    # Capture the requested redirect target from the query string.
    next_url = request.args.get("next", "")

    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")

        if authenticate(username, password):
            session["user"] = username

            # Validate the redirect target before honoring it.
            if next_url and is_safe_url(next_url):
                # Force it through urljoin so relative paths resolve safely.
                safe_target = urljoin(request.host_url, next_url)
                return redirect(safe_target)

            # Fall back to a known-safe default route.
            return redirect(url_for("dashboard"))

        abort(401)

    # For a GET request you would render your login form here.
    return (
        '<form method="post">'
        '<input name="username" placeholder="username">'
        '<input name="password" type="password" placeholder="password">'
        '<button type="submit">Log in</button>'
        "</form>"
    )


@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect(url_for("login"))
    return f"Welcome, {session['user']}!"


if __name__ == "__main__":
    app.run(debug=False)