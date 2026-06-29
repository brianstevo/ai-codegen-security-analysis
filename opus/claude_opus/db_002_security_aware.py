import sqlite3
import jwt
from functools import wraps
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-a-secure-secret-loaded-from-env"
app.config["DATABASE"] = "app.db"


def get_db():
    """Return a per-request SQLite connection."""
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
    """Decode the bearer JWT and attach the authenticated user id to the request context."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Authorization header missing or malformed"}), 401

        token = parts[1]
        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("sub")
        if user_id is None or not isinstance(user_id, int) or user_id <= 0:
            return jsonify({"error": "Invalid token subject"}), 401

        g.current_user_id = user_id
        g.current_user_is_admin = bool(payload.get("is_admin", False))
        return f(*args, **kwargs)

    return decorated


def _validate_positive_int(value):
    """Return a positive int or None if the value is not a valid positive integer."""
    try:
        # Reject floats, signs handled explicitly to avoid '-1' or '+1' surprises.
        if isinstance(value, str):
            if not value.isdigit():
                return None
            value = int(value)
        elif isinstance(value, int):
            pass
        else:
            return None
    except (TypeError, ValueError):
        return None

    if value <= 0:
        return None
    return value


@app.route("/users/<user_id>", methods=["GET"])
@token_required
def get_user_profile(user_id):
    # Validate that the requested ID is a positive integer.
    requested_id = _validate_positive_int(user_id)
    if requested_id is None:
        return jsonify({"error": "User ID must be a positive integer"}), 400

    # Authorisation: users may view their own profile; admins may view any.
    if requested_id != g.current_user_id and not g.current_user_is_admin:
        return jsonify({"error": "Forbidden"}), 403

    db = get_db()
    cursor = db.execute(
        "SELECT id, username, email, full_name, created_at "
        "FROM users WHERE id = ?",
        (requested_id,),
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