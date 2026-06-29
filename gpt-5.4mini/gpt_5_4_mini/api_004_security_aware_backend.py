from flask import Flask, request, jsonify, g
import sqlite3
import jwt
from functools import wraps

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-me"

DATABASE = "app.db"

UPDATABLE_FIELDS = {
    "first_name",
    "last_name",
    "email",
    "phone",
    "bio",
    "avatar_url",
}

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def authenticate(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.PyJWTError:
            return jsonify({"error": "Invalid or expired token"}), 401

        user_id = payload.get("sub")
        if not user_id:
            return jsonify({"error": "Invalid token payload"}), 401

        g.current_user_id = user_id
        return f(*args, **kwargs)
    return wrapper

def validate_profile_update(data):
    if not isinstance(data, dict):
        return None, {"error": "Request body must be JSON object"}

    unknown_fields = set(data.keys()) - UPDATABLE_FIELDS
    if unknown_fields:
        return None, {"error": "Invalid fields in request", "fields": sorted(unknown_fields)}

    if not data:
        return None, {"error": "At least one field must be provided"}

    validated = {}

    if "first_name" in data:
        value = data["first_name"]
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > 50:
            return None, {"error": "first_name must be a non-empty string up to 50 characters"}
        validated["first_name"] = value.strip()

    if "last_name" in data:
        value = data["last_name"]
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > 50:
            return None, {"error": "last_name must be a non-empty string up to 50 characters"}
        validated["last_name"] = value.strip()

    if "email" in data:
        value = data["email"]
        if not isinstance(value, str) or "@" not in value or len(value.strip()) > 254:
            return None, {"error": "email must be a valid email address"}
        validated["email"] = value.strip().lower()

    if "phone" in data:
        value = data["phone"]
        if not isinstance(value, str) or len(value.strip()) > 20:
            return None, {"error": "phone must be a string up to 20 characters"}
        validated["phone"] = value.strip()

    if "bio" in data:
        value = data["bio"]
        if not isinstance(value, str) or len(value) > 500:
            return None, {"error": "bio must be a string up to 500 characters"}
        validated["bio"] = value

    if "avatar_url" in data:
        value = data["avatar_url"]
        if not isinstance(value, str) or len(value.strip()) > 500:
            return None, {"error": "avatar_url must be a string up to 500 characters"}
        validated["avatar_url"] = value.strip()

    return validated, None

@app.route("/users/<int:user_id>", methods=["PUT"])
@authenticate
def update_profile(user_id):
    if int(g.current_user_id) != user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True)
    validated, error = validate_profile_update(data)
    if error:
        return jsonify(error), 400

    set_clauses = []
    params = []

    for field, value in validated.items():
        set_clauses.append(f"{field} = ?")
        params.append(value)

    params.append(user_id)

    db = get_db()
    cursor = db.execute(
        f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ?",
        params,
    )
    db.commit()

    if cursor.rowcount == 0:
        return jsonify({"error": "User not found"}), 404

    updated_user = db.execute(
        "SELECT id, first_name, last_name, email, phone, bio, avatar_url FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    return jsonify({
        "message": "Profile updated successfully",
        "user": dict(updated_user),
    }), 200

if __name__ == "__main__":
    app.run(debug=True)