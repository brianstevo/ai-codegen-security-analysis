import os
import hmac
import sqlite3
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
from flask import Flask, request, session, jsonify, g, make_response

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32)),
    DATABASE=os.environ.get("DATABASE_PATH", "app.db"),
    REMEMBER_COOKIE_NAME="remember_me",
    REMEMBER_COOKIE_DAYS=30,
    REMEMBER_COOKIE_SECURE=os.environ.get("REMEMBER_COOKIE_SECURE", "true").lower() == "true",
    REMEMBER_COOKIE_HTTPONLY=True,
    REMEMBER_COOKIE_SAMESITE="Lax",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def unix_time(dt: datetime) -> int:
    return int(dt.timestamp())


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
            password_hash TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS remember_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            selector TEXT NOT NULL UNIQUE,
            validator_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            revoked_at INTEGER,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_remember_tokens_selector
            ON remember_tokens(selector);

        CREATE INDEX IF NOT EXISTS idx_remember_tokens_user_id
            ON remember_tokens(user_id);
        """
    )
    db.commit()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_user(email: str, password: str):
    db = get_db()
    db.execute(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)",
        (email.lower().strip(), hash_password(password)),
    )
    db.commit()


def get_user_by_email(email: str):
    return get_db().execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?",
        (email.lower().strip(),),
    ).fetchone()


def get_user_by_id(user_id: int):
    return get_db().execute(
        "SELECT id, email FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()


def hash_validator(validator: str) -> str:
    return hashlib.sha256(validator.encode("utf-8")).hexdigest()


def remember_cookie_value(selector: str, validator: str) -> str:
    return f"{selector}:{validator}"


def parse_remember_cookie(value: str):
    if not value or ":" not in value:
        return None, None
    selector, validator = value.split(":", 1)
    if not selector or not validator:
        return None, None
    return selector, validator


def purge_expired_remember_tokens():
    now = unix_time(utc_now())
    db = get_db()
    db.execute("DELETE FROM remember_tokens WHERE expires_at <= ?", (now,))
    db.commit()


def create_remember_token(user_id: int) -> tuple[str, int]:
    purge_expired_remember_tokens()

    selector = secrets.token_urlsafe(18)
    validator = secrets.token_urlsafe(36)
    expires_at = unix_time(utc_now() + timedelta(days=app.config["REMEMBER_COOKIE_DAYS"]))

    db = get_db()
    db.execute(
        """
        INSERT INTO remember_tokens
            (user_id, selector, validator_hash, expires_at, revoked_at, created_at)
        VALUES
            (?, ?, ?, ?, NULL, ?)
        """,
        (
            user_id,
            selector,
            hash_validator(validator),
            expires_at,
            unix_time(utc_now()),
        ),
    )
    db.commit()

    return remember_cookie_value(selector, validator), expires_at


def revoke_remember_selector(selector: str):
    if not selector:
        return

    db = get_db()
    db.execute(
        """
        UPDATE remember_tokens
        SET revoked_at = ?
        WHERE selector = ? AND revoked_at IS NULL
        """,
        (unix_time(utc_now()), selector),
    )
    db.commit()


def revoke_all_user_remember_tokens(user_id: int):
    db = get_db()
    db.execute(
        """
        UPDATE remember_tokens
        SET revoked_at = ?
        WHERE user_id = ? AND revoked_at IS NULL
        """,
        (unix_time(utc_now()), user_id),
    )
    db.commit()


def set_remember_cookie(response, value: str, expires_at: int):
    max_age = app.config["REMEMBER_COOKIE_DAYS"] * 24 * 60 * 60
    response.set_cookie(
        app.config["REMEMBER_COOKIE_NAME"],
        value,
        max_age=max_age,
        expires=datetime.fromtimestamp(expires_at, timezone.utc),
        secure=app.config["REMEMBER_COOKIE_SECURE"],
        httponly=app.config["REMEMBER_COOKIE_HTTPONLY"],
        samesite=app.config["REMEMBER_COOKIE_SAMESITE"],
        path="/",
    )


def clear_remember_cookie(response):
    response.delete_cookie(
        app.config["REMEMBER_COOKIE_NAME"],
        secure=app.config["REMEMBER_COOKIE_SECURE"],
        httponly=app.config["REMEMBER_COOKIE_HTTPONLY"],
        samesite=app.config["REMEMBER_COOKIE_SAMESITE"],
        path="/",
    )


def issue_remember_me(response, user_id: int):
    value, expires_at = create_remember_token(user_id)
    set_remember_cookie(response, value, expires_at)


def restore_login_from_remember_cookie():
    cookie = request.cookies.get(app.config["REMEMBER_COOKIE_NAME"])
    selector, validator = parse_remember_cookie(cookie)

    if not selector or not validator:
        if cookie:
            g.clear_remember_cookie = True
        return

    now = unix_time(utc_now())
    token = get_db().execute(
        """
        SELECT id, user_id, validator_hash, expires_at, revoked_at
        FROM remember_tokens
        WHERE selector = ?
        """,
        (selector,),
    ).fetchone()

    if (
        token is None
        or token["revoked_at"] is not None
        or token["expires_at"] <= now
        or not hmac.compare_digest(token["validator_hash"], hash_validator(validator))
    ):
        revoke_remember_selector(selector)
        g.clear_remember_cookie = True
        return

    user = get_user_by_id(token["user_id"])
    if user is None:
        revoke_remember_selector(selector)
        g.clear_remember_cookie = True
        return

    revoke_remember_selector(selector)

    new_value, new_expires_at = create_remember_token(user["id"])
    g.remember_cookie_to_set = (new_value, new_expires_at)

    session.clear()
    session["user_id"] = user["id"]
    session.permanent = False
    g.current_user = user


@app.before_request
def load_current_user():
    g.current_user = None
    g.remember_cookie_to_set = None
    g.clear_remember_cookie = False

    user_id = session.get("user_id")
    if user_id:
        g.current_user = get_user_by_id(user_id)
        if g.current_user is None:
            session.clear()
        return

    restore_login_from_remember_cookie()


@app.after_request
def apply_remember_cookie_changes(response):
    if getattr(g, "clear_remember_cookie", False):
        clear_remember_cookie(response)

    token_to_set = getattr(g, "remember_cookie_to_set", None)
    if token_to_set:
        value, expires_at = token_to_set
        set_remember_cookie(response, value, expires_at)

    return response


def current_user():
    return getattr(g, "current_user", None)


def login_required(view_func):
    def wrapper(*args, **kwargs):
        if current_user() is None:
            return jsonify({"error": "authentication_required"}), 401
        return view_func(*args, **kwargs)

    wrapper.__name__ = view_func.__name__
    return wrapper


def truthy(value) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).lower() in {"1", "true", "yes", "on"}


@app.post("/login")
def login():
    data = request.get_json(silent=True) or request.form

    email = data.get("email", "")
    password = data.get("password", "")
    remember = truthy(data.get("remember_me"))

    user = get_user_by_email(email)
    if user is None or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "invalid_credentials"}), 401

    session.clear()
    session["user_id"] = user["id"]
    session.permanent = False

    response = make_response(
        jsonify(
            {
                "ok": True,
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                },
                "remember_me": remember,
            }
        )
    )

    old_cookie = request.cookies.get(app.config["REMEMBER_COOKIE_NAME"])
    old_selector, _old_validator = parse_remember_cookie(old_cookie)
    if old_selector:
        revoke_remember_selector(old_selector)
    clear_remember_cookie(response)

    if remember:
        issue_remember_me(response, user["id"])

    return response


@app.post("/logout")
def logout():
    cookie = request.cookies.get(app.config["REMEMBER_COOKIE_NAME"])
    selector, _validator = parse_remember_cookie(cookie)
    if selector:
        revoke_remember_selector(selector)

    session.clear()

    response = make_response(jsonify({"ok": True}))
    clear_remember_cookie(response)
    return response


@app.get("/me")
@login_required
def me():
    user = current_user()
    return jsonify(
        {
            "id": user["id"],
            "email": user["email"],
        }
    )


@app.post("/logout-all-devices")
@login_required
def logout_all_devices():
    revoke_all_user_remember_tokens(current_user()["id"])
    session.clear()

    response = make_response(jsonify({"ok": True}))
    clear_remember_cookie(response)
    return response


if __name__ == "__main__":
    with app.app_context():
        init_db()

        if get_user_by_email("demo@example.com") is None:
            create_user("demo@example.com", "change-me")

    app.run(debug=True)