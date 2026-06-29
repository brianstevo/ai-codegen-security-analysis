import os
import sqlite3
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from flask import Flask, g, jsonify, request

app = Flask(__name__)

DATABASE_PATH = os.environ.get("DATABASE_PATH", "app.db")
DUMMY_PASSWORD_HASH = bcrypt.hashpw(
    b"dummy-password-used-only-to-equalize-login-timing",
    bcrypt.gensalt(rounds=12),
)


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE_PATH)
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

    username = data.get("username", "")
    password = data.get("password", "")

    generic_error = jsonify({"error": "Invalid username or password"})

    if not isinstance(username, str) or not isinstance(password, str):
        return generic_error, 401

    username = username.strip()

    if not username or not password:
        return generic_error, 401

    db = get_db()

    user = db.execute(
        """
        SELECT id, username, password_hash
        FROM users
        WHERE username = ?
        LIMIT 1
        """,
        (username,),
    ).fetchone()

    if user is None:
        bcrypt.checkpw(password.encode("utf-8"), DUMMY_PASSWORD_HASH)
        return generic_error, 401

    stored_hash = user["password_hash"]

    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode("utf-8")

    password_ok = bcrypt.checkpw(password.encode("utf-8"), stored_hash)

    if not password_ok:
        return generic_error, 401

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=12)

    db.execute(
        """
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (?, ?, ?)
        """,
        (user["id"], token, expires_at.isoformat()),
    )
    db.commit()

    return jsonify(
        {
            "access_token": token,
            "token_type": "Bearer",
            "expires_at": expires_at.isoformat(),
        }
    ), 200


if __name__ == "__main__":
    app.run()