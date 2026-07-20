import os
import re
import sqlite3
import secrets
from datetime import datetime, timezone

import bcrypt
from flask import (
    Flask,
    abort,
    flash,
    g,
    redirect,
    render_template_string,
    request,
    session,
    url_for,
)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", secrets.token_urlsafe(32))
app.config["DATABASE"] = os.environ.get("DATABASE_PATH", "app.db")

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

REGISTER_TEMPLATE = """
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Register</title></head>
<body>
  {% with messages = get_flashed_messages(with_categories=true) %}
    {% if messages %}
      <ul>
        {% for category, message in messages %}
          <li class="{{ category }}">{{ message }}</li>
        {% endfor %}
      </ul>
    {% endif %}
  {% endwith %}

  <form method="post" action="{{ url_for('register') }}">
    <input type="hidden" name="csrf_token" value="{{ csrf_token }}">

    <label>
      Username
      <input name="username" required minlength="3" maxlength="30" autocomplete="username"
             value="{{ username|default('') }}">
    </label>

    <label>
      Email
      <input type="email" name="email" required maxlength="254" autocomplete="email"
             value="{{ email|default('') }}">
    </label>

    <label>
      Password
      <input type="password" name="password" required minlength="12" autocomplete="new-password">
    </label>

    <label>
      Confirm Password
      <input type="password" name="confirm_password" required minlength="12" autocomplete="new-password">
    </label>

    <button type="submit">Create Account</button>
  </form>
</body>
</html>
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(app.config["DATABASE"])
    try:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        db.commit()
    finally:
        db.close()


def get_csrf_token():
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return token


def validate_csrf_token(token):
    expected = session.get("csrf_token")
    return bool(expected and token and secrets.compare_digest(expected, token))


def validate_password(password):
    errors = []

    if len(password) < 12:
        errors.append("Password must be at least 12 characters long.")
    if len(password) > 128:
        errors.append("Password must be no more than 128 characters long.")
    if not any(c.islower() for c in password):
        errors.append("Password must include at least one lowercase letter.")
    if not any(c.isupper() for c in password):
        errors.append("Password must include at least one uppercase letter.")
    if not any(c.isdigit() for c in password):
        errors.append("Password must include at least one number.")
    if not any(not c.isalnum() for c in password):
        errors.append("Password must include at least one special character.")

    return errors


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        if not validate_csrf_token(request.form.get("csrf_token", "")):
            abort(400, "Invalid CSRF token.")

        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        errors = []

        if not USERNAME_RE.fullmatch(username):
            errors.append("Username must be 3-30 characters and contain only letters, numbers, and underscores.")

        if not email or len(email) > 254 or not EMAIL_RE.fullmatch(email):
            errors.append("Please enter a valid email address.")

        if password != confirm_password:
            errors.append("Passwords do not match.")

        errors.extend(validate_password(password))

        if not errors:
            password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")
            created_at = datetime.now(timezone.utc).isoformat()

            try:
                db = get_db()
                db.execute(
                    """
                    INSERT INTO users (username, email, password_hash, created_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (username, email, password_hash, created_at),
                )
                db.commit()
            except sqlite3.IntegrityError:
                errors.append("An account with that username or email already exists.")

        if errors:
            for error in errors:
                flash(error, "error")
            return (
                render_template_string(
                    REGISTER_TEMPLATE,
                    csrf_token=get_csrf_token(),
                    username=username,
                    email=email,
                ),
                400,
            )

        session.pop("csrf_token", None)
        flash("Account created successfully. You can now sign in.", "success")
        return redirect(url_for("login"))

    return render_template_string(REGISTER_TEMPLATE, csrf_token=get_csrf_token())


@app.route("/login")
def login():
    return "Login page placeholder"


if __name__ == "__main__":
    init_db()
    app.run(debug=False)