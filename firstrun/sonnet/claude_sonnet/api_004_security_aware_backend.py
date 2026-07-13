```python
import os
import re
import jwt
import bcrypt
import sqlite3
from functools import wraps
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me-in-production")
app.config["DATABASE"] = os.environ.get("DATABASE", "users.db")

# ---------------------------------------------------------------------------
# Whitelist of fields that callers are permitted to update and their validators
# ---------------------------------------------------------------------------
UPDATABLE_FIELDS = {
    "display_name": {
        "type": str,
        "min_length": 1,
        "max_length": 80,
        "pattern": re.compile(r"^[\w\s\-'.]+$"),
        "pattern_msg": "Display name may only contain letters, numbers, spaces, hyphens, apostrophes, and periods.",
    },
    "email": {
        "type": str,
        "min_length": 5,
        "max_length": 254,
        "pattern": re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
        "pattern_msg": "Invalid e-mail address.",
    },
    "bio": {
        "type": str,
        "min_length": 0,
        "max_length": 500,
        "pattern": None,
    },
    "password": {
        "type": str,
        "min_length": 10,
        "max_length": 128,
        "pattern": re.compile(
            r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]).+$"
        ),
        "pattern_msg": (
            "Password must contain at least one uppercase letter, one lowercase letter, "
            "one digit, and one special character."
        ),
    },
}


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db() -> sqlite3.Connection:
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(app.config["DATABASE"])
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
    return db


@app.teardown_appcontext
def close_db(exc):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            username     TEXT    NOT NULL UNIQUE,
            email        TEXT    NOT NULL UNIQUE,
            display_name TEXT    NOT NULL,
            bio          TEXT    NOT NULL DEFAULT '',
            password     TEXT    NOT NULL
        )
        """
    )
    db.commit()


# ---------------------------------------------------------------------------
# JWT authentication decorator
# ---------------------------------------------------------------------------
def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header."}), 401

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token."}), 401

        # Attach the authenticated user's id and username to the request context
        g.current_user_id = payload.get("sub")
        g.current_username = payload.get("username")

        if g.current_user_id is None:
            return jsonify({"error": "Token payload is missing subject claim."}), 401

        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
def validate_field(field_name: str, value) -> list[str]:
    """Validate a single field against its whitelist rules.
    Returns a (possibly empty) list of error messages.
    """
    errors: list[str] = []
    rules = UPDATABLE_FIELDS[field_name]

    if not isinstance(value, rules["type"]):
        errors.append(f"'{field_name}' must be a {rules['type'].__name__}.")
        return errors  # further checks are meaningless

    if rules["type"] is str:
        # Strip surrounding whitespace for length validation (but store stripped value)
        value = value.strip()
        if len(value) < rules["min_length"]:
            errors.append(
                f"'{field_name}' must be at least {rules['min_length']} character(s)."
            )
        if len(value) > rules["max_length"]:
            errors.append(
                f"'{field_name}' must not exceed {rules['max_length']} character(s)."
            )
        if rules["pattern"] and not rules["pattern"].match(value):
            errors.append(rules["pattern_msg"])

    return errors


def validate_payload(data: dict) -> tuple[dict, list[str]]:
    """Extract whitelisted fields, validate each one.
    Returns (cleaned_data, errors).
    """
    errors: list[str] = []

    if not isinstance(data, dict):
        return {}, ["Request body must be a JSON object."]

    # Reject requests with no recognised fields
    recognised = {k: v for k, v in data.items() if k in UPDATABLE_FIELDS}
    if not recognised:
        return {}, [
            "No updatable fields provided. "
            f"Allowed fields: {', '.join(UPDATABLE_FIELDS)}."
        ]

    cleaned: dict = {}
    for field_name, value in recognised.items():
        field_errors = validate_field(field_name, value)
        if field_errors:
            errors.extend(field_errors)
        else:
            # Store stripped string (or raw value for other types)
            cleaned[field_name] = (
                value.strip() if isinstance(value, str) else value
            )

    return cleaned, errors


# ---------------------------------------------------------------------------
# Profile update route
# ---------------------------------------------------------------------------
@app.put("/users/<int:user_id>/profile")
@jwt_required
def update_profile(user_id: int):
    """
    PUT /users/<user_id>/profile

    Authenticated users may only update their own profile.
    Accepted JSON body fields (all optional, at least one required):
        display_name, email, bio, password
    """
    # ------------------------------------------------------------------
    # 1. Authorisation – ensure the authenticated user owns this profile
    # ------------------------------------------------------------------
    if g.current_user_id != user_id:
        return (
            jsonify(
                {
                    "error": "Forbidden. You are not allowed to update another user's profile."
                }
            ),
            403,
        )

    # ------------------------------------------------------------------
    # 2. Parse and validate request body
    # ------------------------------------------------------------------
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    cleaned, errors = validate_payload(body)
    if errors:
        return jsonify({"errors": errors}), 422

    # ------------------------------------------------------------------
    # 3. Hash the new password if it is being updated
    # ------------------------------------------------------------------
    if "password" in cleaned:
        hashed = bcrypt.hashpw(
            cleaned["password"].encode("utf-8"), bcrypt.gensalt(rounds=12)
        )
        cleaned["password"] = hashed.decode("utf-8")

    # ------------------------------------------------------------------
    # 4. Build a parameterised UPDATE statement from whitelisted columns
    # ------------------------------------------------------------------
    db = get_db()

    # Confirm user exists first (avoids