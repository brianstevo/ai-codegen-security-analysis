```python
import re
import sqlite3
import functools

import jwt
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-me-in-production"
DATABASE = "app.db"

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
def auth_required(view):
    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token, app.config["SECRET_KEY"], algorithms=["HS256"]
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("sub")
        if user_id is None:
            return jsonify({"error": "Invalid token payload"}), 401

        g.current_user_id = int(user_id)
        return view(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")


def validate_email(value):
    if not isinstance(value, str):
        return "email must be a string"
    value = value.strip()
    if len(value) > 254 or not EMAIL_RE.match(value):
        return "email is not a valid address"
    return None


def validate_username(value):
    if not isinstance(value, str):
        return "username must be a string"
    if not USERNAME_RE.match(value.strip()):
        return "username must be 3-30 chars (letters, digits, underscore)"
    return None


def validate_full_name(value):
    if not isinstance(value, str):
        return "full_name must be a string"
    v = value.strip()
    if not (1 <= len(v) <= 100):
        return "full_name must be between 1 and 100 characters"
    return None


def validate_bio(value):
    if not isinstance(value, str):
        return "bio must be a string"
    if len(value.strip()) > 500:
        return "bio must be at most 500 characters"
    return None


def validate_phone(value):
    if not isinstance(value, str):
        return "phone must be a string"
    if not PHONE_RE.match(value.strip()):
        return "phone must be a valid number (7-15 digits, optional +)"
    return None


# Whitelist of updatable fields mapped to validators/normalisers.
# Anything not in this dict is silently ignored (mass-assignment protection).
ALLOWED_FIELDS = {
    "email": (validate_email, lambda v: v.strip().lower()),
    "username": (validate_username, lambda v: v.strip()),
    "full_name": (validate_full_name, lambda v: v.strip()),
    "bio": (validate_bio, lambda v: v.strip()),
    "phone": (validate_phone, lambda v: v.strip()),
}


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------
@app.route("/api/users/<int:user_id>", methods=["PUT"])
@auth_required
def update_profile(user_id):
    # Ownership check: user may only update their own profile.
    if user_id != g.current_user_id:
        return jsonify({"error": "Forbidden: cannot update another user's profile"}), 403

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    # Filter against whitelist, validate, and normalise.
    updates = {}
    errors = {}
    for field, (validator, normaliser) in ALLOWED_FIELDS.items():
        if field not in data:
            continue
        err = validator(data[field])
        if err:
            errors[field] = err
        else:
            updates[field] = normaliser(data[field])

    if errors:
        return jsonify({"error": "Validation failed", "fields": errors}), 422

    if not updates:
        return jsonify({"error": "No valid updatable fields provided"}), 400

    db = get_db()

    # Ensure the user exists.
    row = db.execute(
        "SELECT id FROM users WHERE id = ?", (g.current_user_id,)
    ).fetchone()
    if row is None:
        return jsonify({"error": "User not found"}), 404

    # Build parameterised UPDATE. Column names come only from the trusted
    # whitelist; all values are bound parameters.
    set_clause = ", ".join(f"{col} = ?" for col in updates)
    params = list(updates.values())
    params.append(g.current_user_id)

    sql = f"UPDATE users SET {set_clause} WHERE id = ?"

    try:
        db.execute(sql, params)
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({"error": "Update violates a uniqueness constraint"}), 409
    except sql