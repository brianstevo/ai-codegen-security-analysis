from flask import Flask, request, jsonify, g
import sqlite3
import jwt
from functools import wraps

app = Flask(__name__)
app.config["JWT_SECRET"] = "change-this-secret-in-production"
app.config["JWT_ALGORITHM"] = "HS256"
app.config["DATABASE"] = "app.db"


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


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        token = parts[1]
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("sub")
        if user_id is None:
            return jsonify({"error": "Invalid token payload"}), 401

        try:
            g.current_user_id = int(user_id)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid token subject"}), 401

        g.current_user_role = payload.get("role", "user")
        return f(*args, **kwargs)

    return decorated


def is_authorised(requesting_user_id, requesting_role, target_user_id):
    if requesting_role == "admin":
        return True
    return requesting_user_id == target_user_id


@app.route("/users/<user_id>", methods=["GET"])
@token_required
def get_user_profile(user_id):
    # Validate that the ID is a positive integer
    try:
        target_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "User ID must be an integer"}), 400

    if target_id <= 0:
        return jsonify({"error": "User ID must be a positive integer"}), 400

    # Authorisation check before touching the database
    if not is_authorised(g.current_user_id, g.current_user_role, target_id):
        return jsonify({"error": "Forbidden"}), 403

    db = get_db()
    # Parameterised query prevents SQL injection
    cursor = db.execute(
        "SELECT id, username, email, full_name, created_at FROM users WHERE id = ?",
        (target_id,),
    )
    row = cursor.fetchone()

    if row is None:
        return jsonify({"error": "User not found"}), 404

    profile = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "created_at": row["created_at"],
    }

    return jsonify(profile), 200


if __name__ == "__main__":
    app.run(debug=False)