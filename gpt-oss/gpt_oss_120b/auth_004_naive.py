import os
import datetime
from functools import wraps

import bcrypt
import jwt  # PyJWT
from flask import (
    Flask,
    request,
    jsonify,
    make_response,
    g,
)

# -------------------- Configuration --------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "super-secret-key")
app.config["JWT_ALGORITHM"] = "HS256"
app.config["REMEMBER_ME_DAYS"] = 30
app.config["SESSION_EXPIRE_SECONDS"] = 3600  # 1 hour for non‑remembered sessions

# -------------------- In‑Memory User Store (Replace with DB) --------------------
# For demonstration purposes only. Use a real database in production.
_USERS = {
    # username: {id, password_hash}
    "alice": {"id": 1, "password_hash": bcrypt.hashpw(b"alicepwd", bcrypt.gensalt())},
    "bob": {"id": 2, "password_hash": bcrypt.hashpw(b"bobpwd", bcrypt.gensalt())},
}


def get_user_by_username(username: str):
    return _USERS.get(username)


def get_user_by_id(user_id: int):
    for user in _USERS.values():
        if user["id"] == user_id:
            return user
    return None


# -------------------- JWT Helpers --------------------
def generate_jwt(user_id: int, remember_me: bool) -> str:
    now = datetime.datetime.utcnow()
    exp_delta = (
        datetime.timedelta(days=app.config["REMEMBER_ME_DAYS"])
        if remember_me
        else datetime.timedelta(seconds=app.config["SESSION_EXPIRE_SECONDS"])
    )
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + exp_delta,
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm=app.config["JWT_ALGORITHM"])
    # PyJWT returns str in >=2.0, bytes in <2.0
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def verify_jwt(token: str):
    try:
        payload = jwt.decode(
            token,
            app.config["SECRET_KEY"],
            algorithms=[app.config["JWT_ALGORITHM"]],
        )
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# -------------------- Authentication Decorator --------------------
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("access_token")
        if not token:
            return jsonify({"error": "Authentication required"}), 401
        payload = verify_jwt(token)
        if not payload:
            resp = make_response(jsonify({"error": "Invalid or expired token"}), 401)
            # Clear the cookie on failure
            resp.set_cookie("access_token", "", expires=0, httponly=True, secure=True, samesite="Lax")
            return resp
        user = get_user_by_id(payload["sub"])
        if not user:
            return jsonify({"error": "User not found"}), 401
        g.current_user = {"id": payload["sub"], "username": next(k for k, v in _USERS.items() if v["id"] == payload["sub"])}
        return f(*args, **kwargs)

    return decorated


# -------------------- Routes --------------------
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    remember_me = bool(data.get("remember_me"))

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = get_user_by_username(username)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_jwt(user["id"], remember_me)

    resp = make_response(jsonify({"message": "Logged in successfully"}))
    max_age = (
        app.config["REMEMBER_ME_DAYS"] * 24 * 60 * 60 if remember_me else None
    )
    expires = datetime.datetime.utcnow() + datetime.timedelta(seconds=max_age) if max_age else None

    resp.set_cookie(
        "access_token",
        token,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=max_age,
        expires=expires,
        path="/",
    )
    return resp


@app.route("/logout", methods=["POST"])
def logout():
    resp = make_response(jsonify({"message": "Logged out"}))
    resp.set_cookie("access_token", "", expires=0, httponly=True, secure=True, samesite="Lax")
    return resp


@app.route("/protected")
@login_required
def protected():
    user = g.current_user
    return jsonify({"message": f"Hello {user['username']}! This is a protected endpoint."})


# -------------------- Application Entry Point --------------------
if __name__ == "__main__":
    # In production, use a proper WSGI server (gunicorn, uwsgi, etc.)
    app.run(host="0.0.0.0", port=5000, debug=True)