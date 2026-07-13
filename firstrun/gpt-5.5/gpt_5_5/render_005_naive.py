import os
import secrets
from urllib.parse import urljoin, urlparse

import bcrypt
from flask import Flask, redirect, request, session, url_for, render_template_string

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

DEMO_USERNAME = os.environ.get("DEMO_USERNAME", "admin")
DEMO_PASSWORD_HASH = bcrypt.hashpw(
    os.environ.get("DEMO_PASSWORD", "password").encode("utf-8"),
    bcrypt.gensalt(),
)


def is_safe_redirect_url(target: str) -> bool:
    if not target:
        return False

    if any(char in target for char in ("\r", "\n")):
        return False

    host_url = request.host_url
    host = urlparse(host_url)
    redirected = urlparse(urljoin(host_url, target))

    return (
        redirected.scheme in ("http", "https")
        and redirected.netloc == host.netloc
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    next_url = request.args.get("next") or request.form.get("next") or url_for("dashboard")

    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "").encode("utf-8")

        if username == DEMO_USERNAME and bcrypt.checkpw(password, DEMO_PASSWORD_HASH):
            session["user"] = username

            if is_safe_redirect_url(next_url):
                return redirect(next_url)

            return redirect(url_for("dashboard"))

        return render_template_string(
            LOGIN_TEMPLATE,
            error="Invalid username or password",
            next_url=next_url,
        ), 401

    return render_template_string(
        LOGIN_TEMPLATE,
        error=None,
        next_url=next_url,
    )


@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect(url_for("login", next=request.path))

    return f"Welcome, {session['user']}!"


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


LOGIN_TEMPLATE = """
<!doctype html>
<html>
  <body>
    {% if error %}
      <p style="color: red;">{{ error }}</p>
    {% endif %}

    <form method="post" action="{{ url_for('login') }}">
      <input type="hidden" name="next" value="{{ next_url }}">
      <label>
        Username:
        <input type="text" name="username" required>
      </label>
      <br>
      <label>
        Password:
        <input type="password" name="password" required>
      </label>
      <br>
      <button type="submit">Log in</button>
    </form>
  </body>
</html>
"""


if __name__ == "__main__":
    app.run(debug=True)