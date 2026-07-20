import os
import re
import sqlite3
from functools import wraps

import jwt
from flask import Flask, g, jsonify, request

app = Flask(__name__)

DATABASE_PATH = os.environ.get("DATABASE_PATH", "app.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-secret")
JWT_ALGORITHM = "HS256"

UPDATABLE_USER_FIELDS = {
    "email",
    "display_name",
    "bio",
    "phone",
}

EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")
PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")


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


def init_db():
    db = sqlite3.connect(DATABASE_PATH)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            bio TEXT,
            phone TEXT,
            is_admin INTEGER NOT NULL DEFAULT 0,
            password_hash TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db.commit()
    db.close()


def error_response(status_code, message, details=None):
    body = {"error": message}
    if details is not None:
        body["details"] = details
    return jsonify(body), status_code


def require_auth(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        scheme, _, token = auth_header.partition(" ")

        if scheme.lower() != "bearer" or not token:
            return error_response(401, "Missing or invalid Authorization header")

        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"require": ["sub", "exp"]},
            )
            g.current_user_id = int(payload["sub"])
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError, TypeError):
            return error_response(401, "Invalid or expired token")

        return view_func(*args, **kwargs)

    return wrapper


def validate_user_update_payload(payload):
    errors = {}
    validated = {}

    if not isinstance(payload, dict):
        return None, {"body": "JSON request body must be an object"}

    unknown_fields = sorted(set(payload.keys()) - UPDATABLE_USER_FIELDS)
    if unknown_fields:
        errors["unknown_fields"] = [
            f"Field '{field}' is not allowed to be updated" for field in unknown_fields
        ]

    if not any(field in UPDATABLE_USER_FIELDS for field in payload):
        errors["body"] = "At least one updatable field is required"

    if "email" in payload:
        value = payload["email"]
        if not isinstance(value, str):
            errors["email"] = "Email must be a string"
        else:
            value = value.strip().lower()
            if not value:
                errors["email"] = "Email is required"
            elif len(value) > 254:
                errors["email"] = "Email must be 254 characters or fewer"
            elif not EMAIL_RE.fullmatch(value):
                errors["email"] = "Email format is invalid"
            else:
                validated["email"] = value

    if "display_name" in payload:
        value = payload["display_name"]
        if not isinstance(value, str):
            errors["display_name"] = "Display name must be a string"
        else:
            value = value.strip()
            if not value:
                errors["display_name"] = "Display name is required"
            elif len(value) > 80:
                errors["display_name"] = "Display name must be 80 characters or fewer"
            else:
                validated["display_name"] = value

    if "bio" in payload:
        value = payload["bio"]
        if value is None:
            validated["bio"] = None
        elif not isinstance(value, str):
            errors["bio"] = "Bio must be a string or null"
        else:
            value = value.strip()
            if len(value) > 500:
                errors["bio"] = "Bio must be 500 characters or fewer"
            else:
                validated["bio"] = value

    if "phone" in payload:
        value = payload["phone"]
        if value is None:
            validated["phone"] = None
        elif not isinstance(value, str):
            errors["phone"] = "Phone must be a string or null"
        else:
            value = re.sub(r"[\s().-]", "", value.strip())
            if not value:
                validated["phone"] = None
            elif not PHONE_RE.fullmatch(value):
                errors["phone"] = "Phone must be a valid E.164-style number"
            else:
                validated["phone"] = value

    return validated, errors


@app.put("/api/users/<int:user_id>")
@require_auth
def update_own_profile(user_id):
    if g.current_user_id != user_id:
        return error_response(403, "You can only update your own profile")

    if not request.is_json:
        return error_response(415, "Content-Type must be application/json")

    payload = request.get_json(silent=True)
    validated, validation_errors = validate_user_update_payload(payload)
    if validation_errors:
        return error_response(400, "Validation failed", validation_errors)

    db = get_db()

    user = db.execute(
        "SELECT id FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if user is None:
        return error_response(404, "User not found")

    if "email" in validated:
        existing_email = db.execute(
            "SELECT id FROM users WHERE email = ? AND id <> ?",
            (validated["email"], user_id),
        ).fetchone()
        if existing_email is not None:
            return error_response(409, "Email is already in use")

    set_clauses = [f"{field} = :{field}" for field in validated.keys()]
    set_clauses.append("updated_at = CURRENT_TIMESTAMP")

    params = dict(validated)
    params["id"] = user_id

    db.execute(
        f"""
        UPDATE users
        SET {", ".join(set_clauses)}
        WHERE id = :id
        """,
        params,
    )
    db.commit()

    updated_user = db.execute(
        """
        SELECT id, email, display_name, bio, phone, created_at, updated_at
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()

    return jsonify(dict(updated_user)), 200


if __name__ == "__main__":
    init_db()
    app.run(debug=False)