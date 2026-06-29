from flask import Flask, request, jsonify, g
from functools import wraps
import sqlite3
import re
import jwt

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-strong-secret"
app.config["DATABASE"] = "app.db"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Explicit whitelist to prevent mass assignment
UPDATABLE_FIELDS = {
    "display_name": {"type": str, "min": 1, "max": 80},
    "email": {"type": str, "validator": lambda v: bool(EMAIL_RE.match(v)), "max": 254},
    "bio": {"type": str, "max": 500},
    "phone": {"type": str, "validator": lambda v: re.fullmatch(r"^\+?[0-9\-\s]{7,20}$", v) is not None},
    "timezone": {"type": str, "max": 64},
}


def get_db():
    db = getattr(g, "_db", None)
    if db is None:
        db = sqlite3.connect(app.config["DATABASE"])
        db.row_factory = sqlite3.Row
        g._db = db
    return db


@app.teardown_appcontext
def close_db(_exc):
    db = getattr(g, "_db", None)
    if db is not None:
        db.close()


def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        token = auth.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            user_id = payload.get("sub")
            if not isinstance(user_id, int):
                return jsonify({"error": "Invalid token subject"}), 401
            g.current_user_id = user_id
        except jwt.PyJWTError:
            return jsonify({"error": "Invalid or expired token"}), 401
        return fn(*args, **kwargs)

    return wrapper


def validate_payload(data):
    if not isinstance(data, dict):
        return None, {"error": "JSON body must be an object"}

    unknown = [k for k in data.keys() if k not in UPDATABLE_FIELDS]
    if unknown:
        return None, {"error": f"Unknown or non-updatable fields: {', '.join(unknown)}"}

    if not data:
        return None, {"error": "No updatable fields provided"}

    validated = {}
    for field, value in data.items():
        rules = UPDATABLE_FIELDS[field]
        expected_type = rules["type"]

        if value is None:
            return None, {"error": f"Field '{field}' cannot be null"}

        if not isinstance(value, expected_type):
            return None, {"error": f"Field '{field}' must be of type {expected_type.__name__}"}

        if isinstance(value, str):
            value = value.strip()
            if "min" in rules and len(value) < rules["min"]:
                return None, {"error": f"Field '{field}' must be at least {rules['min']} characters"}
            if "max" in rules and len(value) > rules["max"]:
                return None, {"error": f"Field '{field}' must be at most {rules['max']} characters"}

        validator = rules.get("validator")
        if validator and not validator(value):
            return None, {"error": f"Field '{field}' is invalid"}

        validated[field] = value

    return validated, None


@app.put("/users/<int:user_id>/profile")
@auth_required
def update_profile(user_id):
    # Enforce ownership: authenticated user can update only their own profile
    if g.current_user_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    payload = request.get_json(silent=True)
    validated, err = validate_payload(payload)
    if err:
        return jsonify(err), 400

    # Build dynamic SET clause from whitelist-validated fields only
    set_parts = [f"{field} = ?" for field in validated.keys()]
    params = list(validated.values())
    params.append(user_id)

    sql = f"""
        UPDATE users
        SET {", ".join(set_parts)},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """

    db = get_db()
    cur = db.execute(sql, params)  # parameterized query
    db.commit()

    if cur.rowcount == 0:
        return jsonify({"error": "User not found"}), 404

    user = db.execute(
        "SELECT id, display_name, email, bio, phone, timezone, updated_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    return jsonify(
        {
            "message": "Profile updated successfully",
            "user": dict(user),
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)