import os
import sqlite3
import secrets
import hashlib
import hmac
import bcrypt
from datetime import datetime, timedelta, timezone
from flask import Flask, request, session, g, jsonify, make_response

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.config["DATABASE"] = os.environ.get("DATABASE", "app.db")
app.config["REMEMBER_COOKIE_NAME"] = "remember_me"
app.config["REMEMBER_COOKIE_DAYS"] = 30
app.config["REMEMBER_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") == "production"
app.config["REMEMBER_COOKIE_SAMESITE"] = "Lax"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def from_iso(value: str) -> datetime:
    return datetime.fromisoformat(value)


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


def init_db():
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS remember_tokens (
            selector TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            validator_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_remember_tokens_user_id
        ON remember_tokens (user_id);

        CREATE INDEX IF NOT EXISTS idx_remember_tokens_expires_at
        ON remember_tokens (expires_at);
        """
    )
    db.commit()


def create_user(email: str, password: str):
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12))
    db = get_db()
    db.execute(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)",
        (email.lower().strip(), password_hash),
    )
    db.commit()


def hash_validator(validator: str) -> str:
    return hmac.new(
        app.config["SECRET_KEY"].encode("utf-8"),
        validator.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def set_remember_cookie(response, user_id: int):
    selector = secrets.token_urlsafe(18)
    validator = secrets.token_urlsafe(36)
    validator_hash = hash_validator(validator)
    expires_at = utcnow() + timedelta(days=app.config["REMEMBER_COOKIE_DAYS"])

    db = get_db()
    db.execute(
        """
        INSERT INTO remember_tokens
            (selector, user_id, validator_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (selector, user_id, validator_hash, iso(expires_at), iso(utcnow())),
    )
    db.commit()

    response.set_cookie(
        app.config["REMEMBER_COOKIE_NAME"],
        f"{selector}:{validator}",
        max_age=app.config["REMEMBER_COOKIE_DAYS"] * 24 * 60 * 60,
        expires=expires_at,
        httponly=True,
        secure=app.config["REMEMBER_COOKIE_SECURE"],
        samesite=app.config["REMEMBER_COOKIE_SAMESITE"],
        path="/",
    )


def clear_remember_cookie(response):
    response.delete_cookie(
        app.config["REMEMBER_COOKIE_NAME"],
        httponly=True,
        secure=app.config["REMEMBER_COOKIE_SECURE"],
        samesite=app.config["REMEMBER_COOKIE_SAMESITE"],
        path="/",
    )


def delete_current_remember_token():
    cookie = request.cookies.get(app.config["REMEMBER_COOKIE_NAME"])
    if not cookie or ":" not in cookie:
        return

    selector, _validator = cookie.split(":", 1)
    db = get_db()
    db.execute("DELETE FROM remember_tokens WHERE selector = ?", (selector,))
    db.commit()


def delete_all_remember_tokens_for_user(user_id: int):
    db = get_db()
    db.execute("DELETE FROM remember_tokens WHERE user_id = ?", (user_id,))
    db.commit()


def cleanup_expired_remember_tokens():
    db = get_db()
    db.execute("DELETE FROM remember_tokens WHERE expires_at <= ?", (iso(utcnow()),))
    db.commit()


@app.before_request
def load_user_from_session_or_remember_cookie():
    g.user = None
    g.rotate_remember_cookie_for_user_id = None
    g.clear_bad_remember_cookie = False

    user_id = session.get("user_id")
    if user_id is not None:
        user = get_db().execute(
            "SELECT id, email FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if user:
            g.user = user
            return
        session.clear()

    cookie = request.cookies.get(app.config["REMEMBER_COOKIE_NAME"])
    if not cookie or ":" not in cookie:
        return

    selector, validator = cookie.split(":", 1)
    token = get_db().execute(
        """
        SELECT selector, user_id, validator_hash, expires_at
        FROM remember_tokens
        WHERE selector = ?
        """,
        (selector,),
    ).fetchone()

    if not token:
        g.clear_bad_remember_cookie = True
        return

    if from_iso(token["expires_at"]) <= utcnow():
        get_db().execute("DELETE FROM remember_tokens WHERE selector = ?", (selector,))
        get_db().commit()
        g.clear_bad_remember_cookie = True
        return

    supplied_hash = hash_validator(validator)
    if not hmac.compare_digest(supplied_hash, token["validator_hash"]):
        get_db().execute("DELETE FROM remember_tokens WHERE user_id = ?", (token["user_id"],))
        get_db().commit()
        session.clear()
        g.clear_bad_remember_cookie = True
        return

    user = get_db().execute(
        "SELECT id, email FROM users WHERE id = ?",
        (token["user_id"],),
    ).fetchone()

    if not user:
        get_db().execute("DELETE FROM remember_tokens WHERE selector = ?", (selector,))
        get_db().commit()
        g.clear_bad_remember_cookie = True
        return

    session["user_id"] = user["id"]
    session.permanent = True
    g.user = user

    get_db().execute("DELETE FROM remember_tokens WHERE selector = ?", (selector,))
    get_db().commit()
    g.rotate_remember_cookie_for_user_id = user["id"]


@app.after_request
def apply_remember_cookie_changes(response):
    if getattr(g, "clear_bad_remember_cookie", False):
        clear_remember_cookie(response)

    user_id = getattr(g, "rotate_remember_cookie_for_user_id", None)
    if user_id is not None:
        set_remember_cookie(response, user_id)

    return response


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""
    remember = bool(data.get("remember_me"))

    user = get_db().execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?",
        (email,),
    ).fetchone()

    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return jsonify({"error": "Invalid email or password"}), 401

    session.clear()
    session["user_id"] = user["id"]
    session.permanent = remember

    response = make_response(jsonify({"message": "Logged in", "user": {"id": user["id"], "email": user["email"]}}))

    if remember:
        cleanup_expired_remember_tokens()
        set_remember_cookie(response, user["id"])
    else:
        delete_all_remember_tokens_for_user(user["id"])
        clear_remember_cookie(response)

    return response


@app.post("/logout")
def logout():
    user_id = session.get("user_id")
    if user_id is not None:
        delete_current_remember_token()

    session.clear()
    response = make_response(jsonify({"message": "Logged out"}))
    clear_remember_cookie(response)
    return response


@app.get("/me")
def me():
    if not g.user:
        return jsonify({"authenticated": False}), 401

    return jsonify(
        {
            "authenticated": True,
            "user": {
                "id": g.user["id"],
                "email": g.user["email"],
            },
        }
    )


@app.cli.command("init-db")
def init_db_command():
    init_db()
    print("Database initialized.")


@app.cli.command("create-demo-user")
def create_demo_user_command():
    init_db()
    try:
        create_user("demo@example.com", "password123")
        print("Created demo@example.com / password123")
    except sqlite3.IntegrityError:
        print("Demo user already exists.")


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)