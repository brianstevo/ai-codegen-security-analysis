from flask import Flask, request, jsonify, g
import sqlite3
import jwt
from functools import wraps

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-a-secure-secret"
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
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"error": "Missing token"}), 401

        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user_id = payload.get("user_id")
        if not user_id:
            return jsonify({"error": "Invalid token payload"}), 401

        g.user_id = user_id
        return f(*args, **kwargs)

    return decorated


@app.route("/api/me", methods=["GET"])
@token_required
def get_current_user():
    db = get_db()
    user = db.execute(
        """
        SELECT id, username, email, full_name, created_at, updated_at
        FROM users
        WHERE id = ?
        """,
        (g.user_id,),
    ).fetchone()

    if user is None:
        return jsonify({"error": "User not found"}), 404

    return jsonify(
        {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "full_name": user["full_name"],
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)