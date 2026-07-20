from flask import Flask, request, jsonify, g
from functools import wraps
import sqlite3
import jwt
import os

app = Flask(__name__)
app.config["DATABASE"] = os.getenv("DATABASE", "app.db")
app.config["JWT_SECRET"] = os.getenv("JWT_SECRET", "change-me")
app.config["JWT_ALGORITHM"] = "HS256"


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


def authenticate(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
        except jwt.PyJWTError:
            return jsonify({"error": "Invalid or expired token"}), 401

        user_id = payload.get("sub")
        if not user_id:
            return jsonify({"error": "Invalid token payload"}), 401

        g.current_user_id = str(user_id)
        return f(*args, **kwargs)

    return wrapper


def validate_profile_update(data):
    errors = {}
    allowed_fields = {
        "first_name": {"type": str, "required": False, "min_len": 1, "max_len": 50},
        "last_name": {"type": str, "required": False, "min_len": 1, "max_len": 50},
        "email": {"type": str, "required": False, "min_len": 5, "max_len": 254},
        "phone": {"type": str, "required": False, "min_len": 7, "max_len": 20},
        "bio": {"type": str, "required": False, "max_len": 500},
    }

    if not isinstance(data, dict):
        return None, {"body": "JSON object required"}

    unknown = set(data.keys()) - set(allowed_fields.keys())
    if unknown:
        errors["fields"] = f"Unknown fields: {', '.join(sorted(unknown))}"

    validated = {}
    for field, rules in allowed_fields.items():
        if field not in data:
            continue

        value = data[field]
        if value is None:
            errors[field] = "Cannot be null"
            continue
        if not isinstance(value, rules["type"]):
            errors[field] = f"Must be of type {rules['type'].__name__}"
            continue

        value = value.strip()
        if "min_len" in rules and len(value) < rules["min_len"]:
            errors[field] = f"Must be at least {rules['min_len']} characters"
            continue
        if "max_len" in rules and len(value) > rules["max_len"]:
            errors[field] = f"Must be at most {rules['max_len']} characters"
            continue

        validated[field] = value

    if "email" in validated:
        email = validated["email"]
        if "@" not in email or email.startswith("@") or email.endswith("@"):
            errors["email"] = "Invalid email address"

    if "phone" in validated:
        phone = validated["phone"]
        if not all(ch.isdigit() or ch in "+-() " for ch in phone):
            errors["phone"] = "Invalid phone number"

    if not validated and not errors:
        errors["body"] = "At least one updatable field must be provided"

    return (validated if not errors else None), (None if not errors else errors)


@app.route("/users/<user_id>", methods=["PUT"])
@authenticate
def update_profile(user_id):
    if str(user_id) != str(g.current_user_id):
        return jsonify({"error": "You can only update your own profile"}), 403

    data = request.get_json(silent=True)
    validated, errors = validate_profile_update(data)

    if errors:
        return jsonify({"errors": errors}), 400

    db = get_db()

    allowed_fields = ["first_name", "last_name", "email", "phone", "bio"]
    update_fields = []
    params = []

    for field in allowed_fields:
        if field in validated:
            update_fields.append(f"{field} = ?")
            params.append(validated[field])

    if not update_fields:
        return jsonify({"error": "No valid fields to update"}), 400

    params.append(str(user_id))

    try:
        cursor = db.execute(
            f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?",
            params,
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Update failed due to a database constraint"}), 409

    if cursor.rowcount == 0:
        return jsonify({"error": "User not found"}), 404

    row = db.execute(
        "SELECT id, first_name, last_name, email, phone, bio FROM users WHERE id = ?",
        (str(user_id),),
    ).fetchone()

    return jsonify(
        {
            "message": "Profile updated successfully",
            "user": dict(row) if row else None,
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)