import secrets
from datetime import datetime, timedelta

from flask import (
    Flask,
    request,
    redirect,
    url_for,
    make_response,
    session,
    abort,
)

app = Flask(__name__)
app.secret_key = secrets.token_urlsafe(32)  # replace with a persistent secret in prod

# ----------------------------------------------------------------------
# In‑memory stores (replace with real DB in production)
# ----------------------------------------------------------------------
users = {
    "alice": {"password_hash": "hashed_password", "id": 1},
    "bob": {"password_hash": "hashed_password", "id": 2},
}
remember_tokens: dict[str, dict] = {}  # token -> {"user_id": int, "expires": datetime}


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def verify_credentials(username: str, password: str) -> bool:
    """Placeholder credential check – replace with real verification."""
    user = users.get(username)
    if not user:
        return False
    # Here you would hash `password` and compare with stored hash.
    return True  # assume always correct for demo


def login_user(user_id: int):
    session["user_id"] = user_id


def logout_user():
    session.pop("user_id", None)


def generate_remember_token() -> str:
    return secrets.token_urlsafe(32)


def set_remember_cookie(resp, token: str, expires: datetime):
    max_age = int((expires - datetime.utcnow()).total_seconds())
    resp.set_cookie(
        "remember_token",
        token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=max_age,
        expires=expires,
    )


def clear_remember_cookie(resp):
    resp.delete_cookie("remember_token")


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        remember = request.form.get("remember") == "on"

        if not verify_credentials(username, password):
            abort(401)

        user_id = users[username]["id"]
        login_user(user_id)

        resp = make_response(redirect(url_for("protected")))

        if remember:
            token = generate_remember_token()
            expires = datetime.utcnow() + timedelta(days=30)
            remember_tokens[token] = {"user_id": user_id, "expires": expires}
            set_remember_cookie(resp, token, expires)

        return resp

    # Simple login form for demonstration
    return """
    <form method="post">
        Username: <input name="username"><br>
        Password: <input type="password" name="password"><br>
        Remember me: <input type="checkbox" name="remember"><br>
        <button type="submit">Login</button>
    </form>
    """


@app.route("/logout")
def logout():
    resp = make_response(redirect(url_for("login")))
    token = request.cookies.get("remember_token")
    if token and token in remember_tokens:
        del remember_tokens[token]
    clear_remember_cookie(resp)
    logout_user()
    return resp


@app.route("/protected")
def protected():
    if "user_id" not in session:
        abort(401)
    user_id = session["user_id"]
    return f"Hello, user #{user_id}! <a href='{url_for('logout')}'>Logout</a>"


# ----------------------------------------------------------------------
# Remember‑me token handling (run before each request)
# ----------------------------------------------------------------------
@app.before_request
def load_user_from_remember_token():
    if "user_id" in session:
        return  # already logged in

    token = request.cookies.get("remember_token")
    if not token:
        return

    data = remember_tokens.get(token)
    if not data:
        # Invalid token – clear cookie
        resp = make_response(redirect(url_for("login")))
        clear_remember_cookie(resp)
        return resp

    if data["expires"] < datetime.utcnow():
        # Expired token – remove and clear cookie
        del remember_tokens[token]
        resp = make_response(redirect(url_for("login")))
        clear_remember_cookie(resp)
        return resp

    # Token is valid – log the user in and rotate the token
    login_user(data["user_id"])

    # Rotate: generate new token, keep same expiration
    new_token = generate_remember_token()
    remember_tokens[new_token] = {
        "user_id": data["user_id"],
        "expires": data["expires"],
    }
    del remember_tokens[token]

    resp = make_response(redirect(request.path))
    set_remember_cookie(resp, new_token, data["expires"])
    return resp


if __name__ == "__main__":
    # In production use a proper WSGI server and enable HTTPS.
    app.run(debug=True)