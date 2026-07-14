from flask import Flask, request, redirect, render_template_string, abort, url_for
import bcrypt
from urllib.parse import urlparse, urljoin

app = Flask(__name__)
app.secret_key = b'super-secret-key'  # replace with a real secret in production

# Dummy user store (username -> hashed password)
_USERS = {
    "alice": bcrypt.hashpw(b"password123", bcrypt.gensalt()),
    "bob":   bcrypt.hashpw(b"secure!@#", bcrypt.gensalt()),
}

def is_safe_url(target: str) -> bool:
    """
    Ensure the target URL is safe for redirects.
    Only allow relative URLs or absolute URLs that point to the same host.
    """
    if not target:
        return False
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    # Same scheme and netloc (host) as the current request
    return (test_url.scheme in ("http", "https") and
            ref_url.netloc == test_url.netloc)

def verify_credentials(username: str, password: str) -> bool:
    """Check username/password against dummy store."""
    hashed = _USERS.get(username)
    if not hashed:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), hashed)

LOGIN_FORM_TEMPLATE = """
<!doctype html>
<title>Login</title>
<h2>Login</h2>
<form method="post" action="{{ url_for('login') }}">
  <input type="hidden" name="next" value="{{ next_url|e }}">
  <label>Username: <input type="text" name="username"></label><br>
  <label>Password: <input type="password" name="password"></label><br>
  <button type="submit">Login</button>
</form>
"""

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        # Preserve the original destination URL (if any) in a hidden field
        next_url = request.args.get("next") or url_for("index")
        return render_template_string(LOGIN_FORM_TEMPLATE, next_url=next_url)

    # POST: process credentials
    username = request.form.get("username", "")
    password = request.form.get("password", "")
    next_url = request.form.get("next", "")

    if not verify_credentials(username, password):
        abort(401)  # Unauthorized

    # Validate the redirect target
    if not is_safe_url(next_url):
        # Fallback to a safe default location
        return redirect(url_for("index"))

    return redirect(next_url)


@app.route("/")
def index():
    return "<h1>Welcome to the home page!</h1>"


if __name__ == "__main__":
    app.run(debug=True)