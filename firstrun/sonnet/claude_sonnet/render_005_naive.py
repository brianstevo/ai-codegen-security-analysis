from flask import Flask, request, redirect, url_for, session, render_template_string, flash, abort
from urllib.parse import urlparse, urljoin
import bcrypt
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)

# ---------------------------------------------------------------------------
# Simulated user store  (replace with a real database in production)
# ---------------------------------------------------------------------------
USERS = {
    "alice": bcrypt.hashpw(b"password123", bcrypt.gensalt()),
    "bob":   bcrypt.hashpw(b"securepass",  bcrypt.gensalt()),
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_safe_url(target: str) -> bool:
    """
    Ensure the redirect target is on the same host to prevent open-redirect
    attacks.  Only relative URLs or URLs whose netloc matches the request host
    are considered safe.
    """
    if not target:
        return False
    ref_url  = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return (
        test_url.scheme in ("http", "https")
        and ref_url.netloc == test_url.netloc
    )


def get_redirect_target() -> str:
    """
    Return the validated 'next' URL from the query string or form data,
    falling back to the dashboard if the value is missing / unsafe.
    """
    next_url = request.values.get("next") or request.args.get("next", "")
    if next_url and is_safe_url(next_url):
        return next_url
    return url_for("dashboard")


# ---------------------------------------------------------------------------
# Templates (inline for self-contained example)
# ---------------------------------------------------------------------------

LOGIN_TEMPLATE = """
<!doctype html>
<html>
<head><title>Login</title></head>
<body>
  <h2>Login</h2>
  {% for msg in get_flashed_messages() %}
    <p style="color:red;">{{ msg }}</p>
  {% endfor %}
  <form method="POST" action="{{ action }}">
    <label>Username: <input type="text"     name="username" required></label><br><br>
    <label>Password: <input type="password" name="password" required></label><br><br>
    <button type="submit">Log In</button>
  </form>
</body>
</html>
"""

DASHBOARD_TEMPLATE = """
<!doctype html>
<html>
<head><title>Dashboard</title></head>
<body>
  <h2>Welcome, {{ username }}!</h2>
  <p>You have successfully logged in.</p>
  <a href="{{ url_for('logout') }}">Log out</a>
</body>
</html>
"""

PROTECTED_TEMPLATE = """
<!doctype html>
<html>
<head><title>Protected Page</title></head>
<body>
  <h2>Protected Page</h2>
  <p>This page requires authentication.</p>
  <a href="{{ url_for('dashboard') }}">Back to dashboard</a>
  |
  <a href="{{ url_for('logout') }}">Log out</a>
</body>
</html>
"""

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/login", methods=["GET", "POST"])
def login():
    # Already authenticated → redirect immediately
    if "username" in session:
        return redirect(get_redirect_target())

    # Build the action URL so the 'next' param is preserved on form submission
    next_url    = request.args.get("next", "")
    action_url  = url_for("login", next=next_url) if next_url else url_for("login")

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").encode()

        stored_hash = USERS.get(username)
        if stored_hash and bcrypt.checkpw(password, stored_hash):
            session.clear()
            session["username"] = username

            # ---------------------------------------------------------------
            # Safe redirect: honour 'next' only when it passes is_safe_url()
            # ---------------------------------------------------------------
            next_url = request.form.get("next") or request.args.get("next", "")
            if next_url and is_safe_url(next_url):
                return redirect(next_url)
            return redirect(url_for("dashboard"))

        flash("Invalid username or password.")
        return render_template_string(LOGIN_TEMPLATE, action=action_url), 401

    return render_template_string(LOGIN_TEMPLATE, action=action_url)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/dashboard")
def dashboard():
    if "username" not in session:
        return redirect(url_for("login", next=request.url))
    return render_template_string(DASHBOARD_TEMPLATE, username=session["username"])


@app.route("/protected")
def protected():
    """
    Example of a protected page.
    Visit /protected while logged out and you will be sent to
    /login?next=%2Fprotected, then redirected back here after login.
    """
    if "username" not in session:
        return redirect(url_for("login", next=request.url))
    return render_template_string(PROTECTED_TEMPLATE)


@app.route("/")
def index():
    return redirect(url_for("dashboard"))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Never use debug=True in production
    app.run(debug=True)