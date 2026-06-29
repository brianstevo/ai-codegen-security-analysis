import os
import re
from urllib.parse import unquote, urlsplit

from flask import Flask, abort, redirect, render_template_string, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(32))

TRUSTED_REDIRECT_HOSTS = {
    host.strip().lower()
    for host in os.environ.get(
        "TRUSTED_REDIRECT_HOSTS",
        "app.example.com,trusted.example.org",
    ).split(",")
    if host.strip()
}

USERS = {
    "demo": generate_password_hash("s3cret"),
}

CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def recursively_unquote(value: str, rounds: int = 3) -> str:
    current = value
    for _ in range(rounds):
        decoded = unquote(current)
        if decoded == current:
            break
        current = decoded
    return current


def has_control_chars(value: str) -> bool:
    return bool(CONTROL_CHARS.search(value))


def is_allowed_absolute_url(value: str) -> bool:
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return False

    if parsed.scheme.lower() != "https":
        return False

    if not parsed.netloc or not parsed.hostname:
        return False

    if parsed.username or parsed.password:
        return False

    hostname = parsed.hostname.lower()

    if hostname not in TRUSTED_REDIRECT_HOSTS:
        return False

    return True


def is_safe_return_to(target: str) -> bool:
    if not target or len(target) > 2048:
        return False

    decoded = recursively_unquote(target)

    for candidate in (target, decoded):
        if candidate != candidate.strip():
            return False
        if "\\" in candidate:
            return False
        if has_control_chars(candidate):
            return False

    try:
        parsed_original = urlsplit(target)
        parsed_decoded = urlsplit(decoded)
    except ValueError:
        return False

    original_is_absolute = bool(parsed_original.scheme or parsed_original.netloc)
    decoded_is_absolute = bool(parsed_decoded.scheme or parsed_decoded.netloc)

    if original_is_absolute:
        return is_allowed_absolute_url(target) and (
            not decoded_is_absolute or is_allowed_absolute_url(decoded)
        )

    if decoded_is_absolute:
        return False

    return (
        target.startswith("/")
        and decoded.startswith("/")
        and not target.startswith("//")
        and not decoded.startswith("//")
    )


@app.route("/")
def index():
    return '<a href="/login?returnTo=/dashboard">Login</a>'


@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect(url_for("login", returnTo="/dashboard"))
    return f"Welcome, {session['user']}!"


@app.route("/login", methods=["GET", "POST"])
def login():
    return_to = request.args.get("returnTo", "/dashboard")

    if not is_safe_return_to(return_to):
        abort(400, description="Invalid returnTo redirect target")

    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")

        password_hash = USERS.get(username)
        if password_hash and check_password_hash(password_hash, password):
            session.clear()
            session["user"] = username
            return redirect(return_to)

        abort(401, description="Invalid username or password")

    return render_template_string(
        """
        <!doctype html>
        <html lang="en">
          <head><meta charset="utf-8"><title>Login</title></head>
          <body>
            <form method="post" action="{{ url_for('login', returnTo=return_to) }}">
              <label>
                Username
                <input name="username" autocomplete="username" required>
              </label>
              <label>
                Password
                <input name="password" type="password" autocomplete="current-password" required>
              </label>
              <button type="submit">Login</button>
            </form>
          </body>
        </html>
        """,
        return_to=return_to,
    )


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run(debug=False)