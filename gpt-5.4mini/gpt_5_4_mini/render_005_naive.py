from flask import Flask, request, redirect, session, url_for, render_template_string
from urllib.parse import urlparse, urljoin

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret-key"


def is_safe_url(target: str) -> bool:
    if not target:
        return False
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ("http", "https") and ref_url.netloc == test_url.netloc


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        next_url = request.args.get("next", "/")

        # Replace this with real authentication logic
        if username == "admin" and password == "password":
            session["user_id"] = username

            if not is_safe_url(next_url):
                next_url = url_for("dashboard")

            return redirect(next_url)

        return render_template_string(
            """
            <p>Invalid credentials</p>
            <form method="post">
                <input name="username" placeholder="username">
                <input name="password" type="password" placeholder="password">
                <button type="submit">Login</button>
            </form>
            """
        ), 401

    return render_template_string(
        """
        <form method="post">
            <input name="username" placeholder="username">
            <input name="password" type="password" placeholder="password">
            <button type="submit">Login</button>
        </form>
        """
    )


@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("login", next=request.path))
    return f"Welcome, {session['user_id']}!"


if __name__ == "__main__":
    app.run(debug=True)