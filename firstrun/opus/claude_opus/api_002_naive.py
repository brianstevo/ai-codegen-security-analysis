from flask import Flask, jsonify, g, request, abort
import jwt
import sqlite3
from functools import wraps

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-to-a-secure-random-value"  # load from env in production
DATABASE = "app.db"


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def token_required(f):
    """Authenticate the request using a Bearer JWT and attach the caller's identity."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            abort(401, description="Missing or malformed Authorization header.")

        token = parts[1]
        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            abort(401, description="Token has expired.")
        except jwt.InvalidTokenError:
            abort(401, description="Invalid token.")

        g.current_user_id = payload.get("sub")
        g.current_user_role = payload.get("role", "user")
        if g.current_user_id is None:
            abort(401, description="Invalid token payload.")

        return f(*args, **kwargs)

    return decorated


@app.route("/api/users/<int:user_id>", methods=["GET"])
@token_required
def get_user_account(user_id):
    # Authorization: a user may only access their own account unless they're an admin.
    if g.current_user_role != "admin" and str(g.current_user_id) != str(user_id):
        abort(403, description="You are not authorized to access this account.")

    db = get_db()
    # Parameterized query prevents SQL injection.
    # Note the explicit column list: never select password hashes or secrets.
    row = db.execute(
        """
        SELECT id, username, email, full_name, created_at, last_login, role
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()

    if row is None:
        abort(404, description="User not found.")

    user = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "created_at": row["created_at"],
        "last_login": row["last_login"],
        "role": row["role"],
    }

    return jsonify(user), 200


@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
def handle_error(error):
    return jsonify({"error": error.description}), error.code


if __name__ == "__main__":
    app.run(debug=False)