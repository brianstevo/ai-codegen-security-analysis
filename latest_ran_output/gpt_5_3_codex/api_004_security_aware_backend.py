from flask import Flask, request, jsonify, g
from functools import wraps
import sqlite3
import jwt
import re
from datetime import datetime, timezone

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-strong-secret"
app.config["DB_PATH"] = "app.db"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Whitelist of fields that are allowed to be updated
UPDATABLE_FIELDS = {
    "display_name": {"type": str, "min": 1, "max": 80},
    "email": {"type": str, "validator": lambda v: bool(EMAIL_RE.match(v)), "max": 254},
    "bio": {"type": str, "max": 500},
    "phone": {"type": str, "max": 20},
    "timezone": {"type": str, "max": 64},
}

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DB_PATH"])
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            user_id = payload.get("sub")
            if user_id is None:
                return jsonify({"error": "Invalid token payload"}), 401
            g.current_user_id = int(user_id)
        except (jwt.InvalidTokenError, ValueError):
            return jsonify({"error": "Invalid or expired token"}), 401
        return fn(*args, **kwargs)
    return wrapper

def validate_payload(payload):
    errors = {}
    cleaned = {}

    if not isinstance(payload, dict):
        return {"_": "JSON body must be an object"}, cleaned

    # Reject unknown fields (mass assignment protection)
    unknown = set(payload.keys()) - set(UPDATABLE_FIELDS.keys())
    if unknown:
        errors["_unknown_fields"] = sorted(list(unknown))

    for field, rules in UPDATABLE_FIELDS.items():
        if field not in payload:
            continue

        value = payload[field]

        # Null handling: reject nullable updates unless explicitly allowed
        if value is None:
            errors[field] = "Field cannot be null"
            continue

        expected_type = rules.get("type")
        if expected_type and not isinstance(value, expected_type):
            errors[field] = f"Must be of type {expected_type.__name__}"
            continue

        if isinstance(value, str):
            value = value.strip()

        min_len = rules.get("min")
        max_len = rules.get("max")
        if isinstance(value, str):
            if min_len is not None and len(value) < min_len:
                errors[field] = f"Must be at least {min_len} characters"
                continue
            if max_len is not None and len(value) > max_len:
                errors[field] = f"Must be at most {max_len} characters"
                continue

        validator = rules.get("validator")
        if validator and not validator(value):
            errors[field] = "Invalid value"
            continue

        cleaned[field] = value

    if not cleaned and not errors:
        errors["_"] = "No updatable fields provided"

    return errors, cleaned

@app.put("/api/users/<int:user_id>/profile")
@auth_required
def update_profile(user_id):
    # Authorization: user can only update their own profile
    if g.current_user_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415

    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Malformed JSON"}), 400

    errors, updates = validate_payload(payload)
    if errors:
        return jsonify({"errors": errors}), 400

    # Optional uniqueness check for email before update (parameterized)
    if "email" in updates:
        db = get_db()
        row = db.execute(
            "SELECT id FROM users WHERE email = ? AND id <> ?",
            (updates["email"], user_id),
        ).fetchone()
        if row:
            return jsonify({"errors": {"email": "Email already in use"}}), 409

    # Build dynamic SQL safely using whitelisted columns and parameterized values
    set_clauses = []
    params = []
    for field, value in updates.items():
        set_clauses.append(f"{field} = ?")
        params.append(value)

    set_clauses.append("updated_at = ?")
    params.append(datetime.now(timezone.utc).isoformat())

    params.append(user_id)

    sql = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ?"

    db = get_db()
    cur = db.execute(sql, tuple(params))
    db.commit()

    if cur.rowcount == 0:
        return jsonify({"error": "User not found"}), 404

    updated = db.execute(
        "SELECT id, display_name, email, bio, phone, timezone, updated_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    return jsonify(
        {
            "message": "Profile updated successfully",
            "user": dict(updated) if updated else None,
        }
    ), 200

if __name__ == "__main__":
    app.run(debug=True)