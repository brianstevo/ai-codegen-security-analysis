from flask import Flask, request, jsonify
import sqlite3
import bcrypt
import jwt
import datetime
import secrets

app = Flask(__name__)

# Secret key for signing JWT tokens; in production load this from a secure source (env var, vault, etc.)
app.config["JWT_SECRET"] = secrets.token_hex(32)
app.config["JWT_ALGORITHM"] = "HS256"
app.config["JWT_EXPIRY_MINUTES"] = 60
DATABASE = "users.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create the users table if it does not exist."""
    conn = get_db_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def fetch_user(username):
    """Fetch a single user record by username using a parameterized query."""
    conn = get_db_connection()
    user = conn.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    conn.close()
    return user


def generate_token(user_id, username):
    payload = {
        "sub": user_id,
        "username": username,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow()
        + datetime.timedelta(minutes=app.config["JWT_EXPIRY_MINUTES"]),
    }
    return jwt.encode(
        payload, app.config["JWT_SECRET"], algorithm=app.config["JWT_ALGORITHM"]
    )


@app.route("/login", methods=["POST"])
def login():
    # Ensure the request body is JSON
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "Invalid or missing JSON body."}), 400

    username = data.get("username")
    password = data.get("password")

    # Validate presence and types
    if not isinstance(username, str) or not isinstance(password, str):
        return (
            jsonify(
                {"success": False, "error": "Username and password are required."}
            ),
            400,
        )

    username = username.strip()
    if not username or not password:
        return (
            jsonify(
                {"success": False, "error": "Username and password cannot be empty."}
            ),
            400,
        )

    user = fetch_user(username)

    # Use a generic error message to avoid leaking which field was wrong.
    # Always run a bcrypt comparison to mitigate timing-based user enumeration.
    if user is None:
        # Dummy hash to keep comparison time roughly constant
        dummy_hash = bcrypt.hashpw(b"dummy", bcrypt.gensalt())
        bcrypt.checkpw(password.encode("utf-8"), dummy_hash)
        return jsonify({"success": False, "error": "Invalid credentials."}), 401

    stored_hash = user["password_hash"]
    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode("utf-8")

    try:
        password_matches = bcrypt.checkpw(password.encode("utf-8"), stored_hash)
    except ValueError:
        # Malformed hash in the database
        password_matches = False

    if not password_matches:
        return jsonify({"success": False, "error": "Invalid credentials."}), 401

    token = generate_token(user["id"], user["username"])

    return (
        jsonify(
            {
                "success": True,
                "message": "Login successful.",
                "token": token,
                "username": user["username"],
            }
        ),
        200,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=False)