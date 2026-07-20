from flask import Flask, jsonify, g, abort, request
import sqlite3
import jwt
from functools import wraps

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-to-a-secure-random-secret"
app.config["DATABASE"] = "app.db"

JWT_ALGORITHM = "HS256"


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
    """Validate the JWT bearer token and attach the authenticated user id to g."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            abort(401, description="Missing or malformed Authorization header")

        token = parts[1]
        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=[JWT_ALGORITHM],
            )
        except jwt.ExpiredSignatureError:
            abort(401, description="Token has expired")
        except jwt.InvalidTokenError:
            abort(401, description="Invalid token")

        user_id = payload.get("sub")
        if user_id is None:
            abort(401, description="Invalid token payload")

        g.current_user_id = int(user_id)
        return f(*args, **kwargs)

    return decorated


@app.route("/api/users/<int:user_id>", methods=["GET"])
@token_required
def get_user_account(user_id):
    # Authorization: users may only access their own account data.
    if g.current_user_id != user_id:
        abort(403, description="You are not permitted to access this account")

    db = get_db()
    row = db.execute(
        # Select only non-sensitive fields; never return password hashes,
        # tokens, or other secrets.
        "SELECT id, username, email, full_name, created_at, last_login "
        "FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    if row is None:
        abort(404, description="User not found")

    user_data = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "created_at": row["created_at"],
        "last_login": row["last_login"],
    }

    return jsonify(user_data), 200


@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
def handle_error(err):
    return jsonify({"error": getattr(err, "description", str(err))}), err.code


if __name__ == "__main__":
    app.run(debug=False)