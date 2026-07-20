import os
import sqlite3
from typing import Optional

import bcrypt
from flask import Flask, g, jsonify, request

app = Flask(__name__)

DATABASE_PATH = os.environ.get("DATABASE_PATH", "users.db")
MIN_PASSWORD_LENGTH = 12
BCRYPT_COST = 12


class PasswordValidationError(ValueError):
    pass


class UserNotFoundError(ValueError):
    pass


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exception: Optional[BaseException]) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
            )
            """
        )
        conn.commit()


def validate_password(password: str) -> None:
    if not isinstance(password, str):
        raise PasswordValidationError("Password must be a string.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordValidationError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        )

    if len(password.encode("utf-8")) > 72:
        raise PasswordValidationError(
            "Password is too long for bcrypt; use 72 bytes or fewer."
        )


def hash_password(password: str) -> str:
    validate_password(password)
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=BCRYPT_COST)
    password_hash = bcrypt.hashpw(password_bytes, salt)
    return password_hash.decode("utf-8")


def store_user_password(user_id: int, password: str, conn: Optional[sqlite3.Connection] = None) -> None:
    password_hash = hash_password(password)

    owns_connection = conn is None
    if owns_connection:
        conn = sqlite3.connect(DATABASE_PATH)

    try:
        cursor = conn.execute(
            """
            UPDATE users
            SET password_hash = ?
            WHERE id = ?
            """,
            (password_hash, user_id),
        )

        if cursor.rowcount != 1:
            raise UserNotFoundError("User not found.")

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        if owns_connection:
            conn.close()


def create_user(username: str, password: str, conn: Optional[sqlite3.Connection] = None) -> int:
    password_hash = hash_password(password)

    owns_connection = conn is None
    if owns_connection:
        conn = sqlite3.connect(DATABASE_PATH)

    try:
        cursor = conn.execute(
            """
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
            """,
            (username, password_hash),
        )
        conn.commit()
        return int(cursor.lastrowid)
    except Exception:
        conn.rollback()
        raise
    finally:
        if owns_connection:
            conn.close()


def verify_password(password: str, stored_password_hash: str) -> bool:
    if not isinstance(password, str) or not isinstance(stored_password_hash, str):
        return False

    return bcrypt.checkpw(
        password.encode("utf-8"),
        stored_password_hash.encode("utf-8"),
    )


@app.post("/users")
def create_user_route():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    if not isinstance(username, str) or not username.strip():
        return jsonify({"error": "Username is required."}), 400

    try:
        user_id = create_user(username.strip(), password, get_db())
    except PasswordValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists."}), 409

    return jsonify({"id": user_id, "username": username.strip()}), 201


@app.put("/users/<int:user_id>/password")
def update_password_route(user_id: int):
    data = request.get_json(silent=True) or {}
    password = data.get("password")

    try:
        store_user_password(user_id, password, get_db())
    except PasswordValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except UserNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404

    return jsonify({"status": "password_updated"}), 200


if __name__ == "__main__":
    init_db()
    app.run(debug=False)