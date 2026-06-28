import re
import sqlite3
from functools import wraps

import bcrypt
import jwt
from flask import Flask, request, jsonify, g, abort

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-strong-secret"
app.config["JWT_SECRET"] = "replace-with-another-strong-secret"
app.config["DATABASE"] = "users.db"

# ---------- Database utilities ----------
def get_db():
    if not hasattr(g, "_db"):
        g._db = sqlite3.connect(app.config["DATABASE"])
        g._db.row_factory = sqlite3.Row
    return g._db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_db", None)
    if db is not None:
        db.close()

def init_db():
    """Create a simple users table for demonstration."""
    with app.app_context():
        db = get_db()
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                first_name TEXT,
                last_name TEXT,
                password_hash BLOB NOT NULL
            );
            """
        )
        db.commit()

# ---------- Authentication ----------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            abort(401, description="Missing or malformed Authorization header")
        token = auth.split(None, 1)[1]
        try:
            payload = jwt.decode(token, app.config["JWT_SECRET"], algorithms=["HS256"])
            g.user_id = payload["sub"]
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            abort(401, description="Invalid or expired token")
        return f(*args, **kwargs)
    return decorated_function

# ---------- Validation helpers ----------
EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")

def validate_email(email: str) -> bool:
    return EMAIL_REGEX.match(email) is not None

def validate_password(pwd: str) -> bool:
    return len(pwd) >= 8

# ---------- PUT route ----------
UPDATABLE_FIELDS = {"first_name", "last_name", "email", "password"}

@app.route("/profile", methods=["PUT"])
@login_required
def update_profile():
    if not request.is_json:
        abort(400, description="Request body must be JSON")
    data = request.get_json()

    # Filter only whitelisted fields
    updates = {k: v for k, v in data.items() if k in UPDATABLE_FIELDS}
    if not updates:
        abort(400, description="No valid fields to update")

    # Server‑side validation
    errors = {}
    if "email" in updates and not validate_email(updates["email"]):
        errors["email"] = "Invalid email format"
    if "password" in updates and not validate_password(updates["password"]):
        errors["password"] = "Password must be at least 8 characters long"

    if errors:
        return jsonify({"errors": errors}), 400

    # Prepare values for the UPDATE statement
    set_clauses = []
    params = []

    for field, value in updates.items():
        if field == "password":
            hashed = bcrypt.hashpw(value.encode("utf-8"), bcrypt.gensalt())
            set_clauses.append("password_hash = ?")
            params.append(hashed)
        else:
            set_clauses.append(f"{field} = ?")
            params.append(value)

    set_clause_str = ", ".join(set_clauses)
    params.append(g.user_id)  # WHERE clause parameter

    sql = f"UPDATE users SET {set_clause_str} WHERE id = ?"

    db = get_db()
    cur = db.execute(sql, tuple(params))
    if cur.rowcount == 0:
        abort(404, description="User not found")
    db.commit()

    return jsonify({"message": "Profile updated successfully"}), 200

# ---------- Example login route to obtain JWT (for testing) ----------
@app.route("/login", methods=["POST"])
def login():
    """
    Expects JSON: {"email": "...", "password": "..."}
    Returns a JWT if credentials are valid.
    """
    if not request.is_json:
        abort(400, description="JSON body required")
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        abort(400, description="Email and password required")

    db = get_db()
    user = db.execute(
        "SELECT id, password_hash FROM users WHERE email = ?", (email,)
    ).fetchone()
    if user is None or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        abort(401, description="Invalid credentials")

    token = jwt.encode({"sub": user["id"]}, app.config["JWT_SECRET"], algorithm="HS256")
    return jsonify({"token": token})

# ---------- Run ----------
if __name__ == "__main__":
    init_db()
    app.run(debug=True)