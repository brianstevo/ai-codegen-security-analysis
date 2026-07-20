from urllib.parse import urlparse, urljoin

import bcrypt
from flask import Flask, request, redirect, session, abort, render_template_string

app = Flask(__name__)
app.secret_key = "replace-this-with-a-secure-random-secret-key"

USERS = {
    "alice": bcrypt.hashpw(b"password123", bcrypt.gensalt())
}


def is_safe_redirect_url(target: str) -> bool:
    if not target:
        return False

    host_url = urlparse(request.host_url)
    redirect_url = urlparse(urljoin(request.host_url, target))

    return (
        redirect_url.scheme in ("http", "https")
        and host_url.netloc == redirect_url.netloc
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    next_url = request.args.get("next", "/")

    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "").encode("utf-8")

        stored_hash = USERS.get(username)

        if stored_hash and bcrypt.checkpw(password, stored_hash):
            session["user"] = username

            if not is_safe_redirect_url(next_url):
                abort(400, "Invalid redirect URL")

            return redirect(next_url)

        return "Invalid username or password", 401

    return render_template_string(
        """
        <form method="post">
            <input name="username" placeholder="Username" required>
            <input name="password" type="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
        """
    )


@app.route("/")
def index():
    user = session.get("user")
    if user:
        return f"Hello, {user}!"
    return '<a href="/login?next=/dashboard">Login</a>'


@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect("/login?next=/dashboard")
    return "Dashboard"


if __name__ == "__main__":
    app.run(debug=True)