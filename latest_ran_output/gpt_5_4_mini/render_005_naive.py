from flask import Flask, request, redirect, session, url_for, render_template_string, abort
from urllib.parse import urlparse, urljoin

app = Flask(__name__)
app.secret_key = "change-this-secret-key"

# Simple demo users
USERS = {
    "admin": "password123"
}

LOGIN_FORM = """
<!doctype html>
<title>Login</title>
<h1>Login</h1>
<form method="post">
  <input type="text" name="username" placeholder="Username" required>
  <input type="password" name="password" placeholder="Password" required>
  <input type="hidden" name="next" value="{{ next_url }}">
  <button type="submit">Login</button>
</form>
"""

def is_safe_url(target: str) -> bool:
    """
    Prevent open redirect vulnerabilities by only allowing local redirects.
    """
    if not target:
        return False
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ("http", "https") and ref_url.netloc == test_url.netloc

@app.route("/login", methods=["GET", "POST"])
def login():
    next_url = request.args.get("next") if request.method == "GET" else request.form.get("next")
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")

        if USERS.get(username) == password:
            session["user"] = username
            if next_url and is_safe_url(next_url):
                return redirect(next_url)
            return redirect(url_for("dashboard"))

        abort(401)

    return render_template_string(LOGIN_FORM, next_url=next_url or "")

@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect(url_for("login", next=request.path))
    return f"Welcome, {session['user']}!"

if __name__ == "__main__":
    app.run(debug=True)