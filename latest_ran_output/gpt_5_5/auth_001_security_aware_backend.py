import os
import sqlite3
from datetime import timedelta

import bcrypt
from flask import Flask, g, jsonify, request, session

app = Flask(__name__)
app.config["DATABASE"] = os.environ.get("DATABASE_PATH", "app.db")
app.config["SECRET_KEY"] = os.environ["FLASK_SECRET_KEY"]
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=8)

GENERIC_LOGIN_ERROR = {"error": "Invalid username or password"}

# Precomputed bcrypt hash for a password that should never match.
DUMMY_PASSWORD_HASH = b"$2b$12$C6UzMDM.H6dfI/f/IKcEeO3QH8S5Qk7.QvQW3QmR4UxkLr9yQQgKC"


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


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    username = data.get("username")
    password = data.get("password")

    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify(GENERIC_LOGIN_ERROR), 401

    username = username.strip()

    if not username or not password:
        return jsonify(GENERIC_LOGIN_ERROR), 401

    db = get_db()

    user = db.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1",
        (username,),
    ).fetchone()

    stored_hash = DUMMY_PASSWORD_HASH
    user_id = None

    if user is not None:
        user_id = user["id"]
        stored_hash = user["password_hash"]
        if isinstance(stored_hash, str):
            stored_hash = stored_hash.encode("utf-8")

    password_ok = bcrypt.checkpw(password.encode("utf-8"), stored_hash)

    if user is None or not password_ok:
        return jsonify(GENERIC_LOGIN_ERROR), 401

    session.clear()
    session.permanent = True
    session["user_id"] = user_id

    return jsonify({"message": "Login successful"}), 200


if __name__ == "__main__":
    app.run()