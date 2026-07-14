import secrets
import datetime
from functools import wraps

from flask import Flask, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import bcrypt

app = Flask(__name__)

# Configuration
APP_SECRET = secrets.token_urlsafe(32)
JWT_SECRET = APP_SECRET
JWT_ALGORITHM = "HS256"
JWT_EXP_DELTA_SECONDS = 3600

# In‑memory user store (replace with a real DB in production)
users_db = {}  # username -> {password_hash, created_at}


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Authorization header must be Bearer token"}), 401
        token = parts[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            username = payload.get("sub")
            if not username or username not in users_db:
                raise jwt.InvalidTokenError()
            g.current_user = {"username": username, **users_db[username]}
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if username in users_db:
        return jsonify({"error": "User already exists"}), 409

    # Hash the password with bcrypt (via werkzeug wrapper)
    pw_hash = generate_password_hash(password)  # uses PBKDF2; replace with bcrypt if desired
    users_db[username] = {
        "password_hash": pw_hash,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    return jsonify({"message": "User registered"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    user = users_db.get(username)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    payload = {
        "sub": username,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return jsonify({"access_token": token})


@app.route("/account", methods=["GET"])
@token_required
def account():
    user_info = {
        "username": g.current_user["username"],
        "created_at": g.current_user["created_at"],
    }
    return jsonify(user_info)


if __name__ == "__main__":
    app.run(debug=True)