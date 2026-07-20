from flask import Flask, request, redirect, url_for, session, render_template_string, flash
from urllib.parse import urlparse, urljoin
import bcrypt
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Simulated user database
USERS = {
    "admin": bcrypt.hashpw("password123".encode("utf-8"), bcrypt.gensalt()),
    "user1": bcrypt.hashpw("securepass".encode("utf-8"), bcrypt.gensalt()),
}

LOGIN_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><title>Login</title></head>
<body>
    <h2>Login</h2>
    {% for message in get_flashed_messages() %}
        <p style="color: red;">{{ message }}</p>
    {% endfor %}
    <form method="POST" action="{{ url_for('login', next=next_url) }}">
        <label>Username: <input type="text" name="username" required></label><br><br>
        <label>Password: <input type="password" name="password" required></label><br><br>
        <button type="submit">Login</button>
    </form>
</body>
</html>
"""

DASHBOARD_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><title>Dashboard</title></head>
<body>
    <h2>Welcome, {{ username }}!</h2>
    <p>You are now logged in.</p>
    <a href="{{ url_for('logout') }}">Logout</a>
</body>
</html>
"""


def is_safe_url(target: str) -> bool:
    """
    Validate that the redirect URL is safe (same host only).
    Prevents open redirect vulnerabilities.
    """
    if not target:
        return False

    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))

    # Ensure the scheme is http/https and the host matches
    return (
        test_url.scheme in ("http", "https")
        and ref_url.netloc == test_url.netloc
    )


def get_safe_redirect(next_url: str, fallback: str = "dashboard") -> str:
    """
    Return a safe redirect target. Falls back to the dashboard if the URL is unsafe.
    """
    if next_url and is_safe_url(next_url):
        return next_url
    return url_for(fallback)


@app.route("/login", methods=["GET", "POST"])
def login():
    # If the user is already logged in, redirect appropriately
    if "username" in session:
        next_url = request.args.get("next", "")
        return redirect(get_safe_redirect(next_url))

    next_url = request.args.get("next", "")

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").encode("utf-8")

        # Validate username existence
        if username not in USERS:
            flash("Invalid username or password.")
            return render_template_string(LOGIN_TEMPLATE, next_url=next_url), 401

        # Validate password with bcrypt
        stored_hash = USERS[username]
        if not bcrypt.checkpw(password, stored_hash):
            flash("Invalid username or password.")
            return render_template_string(LOGIN_TEMPLATE, next_url=next_url), 401

        # Successful login — store in session
        session["username"] = username
        session.permanent = False  # Session expires when browser closes

        # Retrieve the next URL from the form post or fall back to query string
        post_next = request.form.get("next", next_url).strip()

        # Redirect to the safe URL
        return redirect(get_safe_redirect(post_next))

    return render_template_string(LOGIN_TEMPLATE, next_url=next_url), 200


@app.route("/dashboard")
def dashboard():
    if "username" not in session:
        return redirect(url_for("login", next=request.url))
    return render_template_string(DASHBOARD_TEMPLATE, username=session["username"])


@app.route("/profile")
def profile():
    """A protected route to demonstrate the redirect-after-login flow."""
    if "username" not in session:
        return redirect(url_for("login", next=request.url))
    return f"<h2>Profile page for {session['username']}</h2><a href='{url_for('logout')}'>Logout</a>"


@app.route("/settings")
def settings():
    """Another protected route to demonstrate the redirect-after-login flow."""
    if "username" not in session:
        return redirect(url_for("login", next=request.url))
    return f"<h2>Settings for {session['username']}</h2><a href='{url_for('logout')}'>Logout</a>"


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
def index():
    return redirect(url_for("dashboard"))


if __name__ == "__main__":
    app.run(debug=True)