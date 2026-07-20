from urllib.parse import urlparse, unquote

import bcrypt
from flask import Flask, abort, redirect, render_template_string, request, session, url_for

app = Flask(__name__)
app.secret_key = "replace-with-a-long-random-secret-key"

TRUSTED_REDIRECT_DOMAINS = {
    "app.example.com",
    "accounts.example.com",
}

USERS = {
    "alice": bcrypt.hashpw(b"correcthorsebatterystaple", bcrypt.gensalt()),
}

LOGIN_TEMPLATE = """
<!doctype html>
<html>
  <body>
    {% if error %}<p style="color:red">{{ error }}</p>{% endif %}
    <form method="post" action="{{ url_for('login', returnTo=return_to) }}">
      <label>Username <input name="username" autocomplete="username"></label>
      <label>Password <input name="password" type="password" autocomplete="current-password"></label>
      <button type="submit">Log in</button>
    </form>
  </body>
</html>
"""


def _contains_control_chars(value: str) -> bool:
    return any(ord(ch) < 32 or ord(ch) == 127 for ch in value)


def is_safe_redirect_target(target: str) -> bool:
    if not target:
        return False

    if target != target.strip():
        return False

    decoded = unquote(target)

    if _contains_control_chars(target) or _contains_control_chars(decoded):
        return False

    if "\\" in target or "\\" in decoded:
        return False

    parsed = urlparse(target)

    if parsed.scheme or parsed.netloc:
        if parsed.scheme != "https":
            return False

        if parsed.username or parsed.password:
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        hostname = hostname.rstrip(".").lower()

        try:
            port = parsed.port
        except ValueError:
            return False

        if port not in (None, 443):
            return False

        return hostname in TRUSTED_REDIRECT_DOMAINS

    if not target.startswith("/"):
        return False

    if target.startswith("//") or decoded.startswith("//"):
        return False

    return True


def authenticate(username: str, password: str) -> bool:
    stored_hash = USERS.get(username)
    if not stored_hash:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), stored_hash)


@app.route("/login", methods=["GET", "POST"])
def login():
    return_to = request.args.get("returnTo") or url_for("dashboard")

    if not is_safe_redirect_target(return_to):
        abort(400, description="Invalid redirect target")

    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")

        if not authenticate(username, password):
            return render_template_string(
                LOGIN_TEMPLATE,
                error="Invalid username or password",
                return_to=return_to,
            ), 401

        session["user"] = username
        return redirect(return_to)

    return render_template_string(
        LOGIN_TEMPLATE,
        error=None,
        return_to=return_to,
    )


@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect(url_for("login", returnTo=request.path))
    return f"Welcome, {session['user']}!"


if __name__ == "__main__":
    app.run(debug=True)