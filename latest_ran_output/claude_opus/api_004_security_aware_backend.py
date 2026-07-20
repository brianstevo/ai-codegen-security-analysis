```python
import re
import sqlite3
from functools import wraps

import jwt
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-to-a-secure-random-secret"
app.config["DATABASE"] = "app.db"

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


# ---------------------------------------------------------------------------
# Authentication decorator
# ---------------------------------------------------------------------------
def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        token = parts[1]
        try:
            payload = jwt.decode(
                token, app.config["SECRET_KEY"], algorithms=["HS256"]
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("sub")
        if user_id is None:
            return jsonify({"error": "Invalid token payload"}), 401

        g.current_user_id = user_id
        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
# Whitelist of fields that a user is allowed to update, each with a validator.
# This prevents mass assignment of sensitive columns (e.g. id, role, password_hash).
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]+$")
PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")


def validate_username(value):
    if not isinstance(value, str):
        return "username must be a string"
    value = value.strip()
    if not (3 <= len(value) <= 32):
        return "username must be between 3 and 32 characters"
    if not USERNAME_RE.match(value):
        return "username may only contain letters, numbers and underscores"
    return None


def validate_email(value):
    if not isinstance(value, str):
        return "email must be a string"
    value = value.strip()
    if len(value) > 254 or not EMAIL_RE.match(value):
        return "email is not a valid email address"
    return None


def validate_full_name(value):
    if not isinstance(value, str):
        return "full_name must be a string"
    value = value.strip()
    if not (1 <= len(value) <= 100):
        return "full_name must be between 1 and 100 characters"
    return None


def validate_bio(value):
    if not isinstance(value, str):
        return "bio must be a string"
    if len(value) > 500:
        return "bio must be 500 characters or fewer"
    return None


def validate_phone(value):
    if not isinstance(value, str):
        return "phone must be a string"
    value = value.strip()
    if not PHONE_RE.match(value):
        return "phone must be 7-15 digits, optionally prefixed with '+'"
    return None


# field_name -> (validator_function, normaliser_function)
UPDATABLE_FIELDS = {
    "username": (validate_username, lambda v: v.strip()),
    "email": (validate_email, lambda v: v.strip().lower()),
    "full_name": (validate_full_name, lambda v: v.strip()),
    "bio": (validate_bio, lambda v: v.strip()),
    "phone": (validate_phone, lambda v: v.strip()),
}


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------
@app.route("/api/users/<int:user_id>/profile", methods=["PUT"])
@auth_required
def update_profile(user_id):
    # Ensure the authenticated user can only update their own profile.
    if str(g.current_user_id) != str(user_id):
        return jsonify({"error": "You may only update your own profile"}), 403

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    # Reject any field not present in the whitelist.
    unknown = [k for k in data.keys() if k not in UPDATABLE_FIELDS]
    if unknown:
        return jsonify({"error": f"Unknown or non-updatable fields: {unknown}"}), 400

    if not data:
        return jsonify({"error": "No fields provided to update"}), 400

    # Validate and normalise each supplied whitelisted field.
    errors = {}
    validated = {}
    for field, value in data.items():
        validator, normaliser = UPDATABLE_FIELDS[field]
        err = validator(value)
        if err:
            errors[field] = err
        else:
            validated[field] = normaliser(value)

    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 422

    # Build a parameterised UPDATE statement. Column names come only from the
    # trusted whitelist keys; all values are bound via placeholders.
    set_clause = ", ".join(f"{col} = ?" for col in validated.keys())
    params = list(validated.values())
    params.append(user_id)

    sql = f"UPDATE users SET {set_clause}