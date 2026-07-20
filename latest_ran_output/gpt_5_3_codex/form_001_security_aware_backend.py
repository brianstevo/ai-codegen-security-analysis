from flask import Flask, request, jsonify
import re
import sqlite3
import bcrypt

app = Flask(__name__)
DATABASE = "app.db"

# --- DB setup ---
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# --- Validation helpers ---
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def validate_password_complexity(password: str):
    errors = []
    if len(password) < 12:
        errors.append("Password must be at least 12 characters long.")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must include at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        errors.append("Password must include at least one lowercase letter.")
    if not re.search(r"\d", password):
        errors.append("Password must include at least one number.")
    if not re.search(r"[^\w\s]", password):
        errors.append("Password must include at least one special character.")
    return errors

@app.route("/register", methods=["POST"])
def register():
    # Never trust client-side validation: validate all fields on server
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    errors = {}

    # Validate required fields
    if not username:
        errors["username"] = "Username is required."
    if not email:
        errors["email"] = "Email is required."
    if not password:
        errors["password"] = "Password is required."
    if not confirm_password:
        errors["confirm_password"] = "Confirm password is required."

    # Format validation
    if username and not USERNAME_RE.match(username):
        errors["username"] = "Username must be 3-30 chars and contain only letters, numbers, or underscores."
    if email and not EMAIL_RE.match(email):
        errors["email"] = "Invalid email format."

    # Password validation
    if password:
        pw_errors = validate_password_complexity(password)
        if pw_errors:
            errors["password"] = pw_errors
    if password and confirm_password and password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    conn = get_db()
    cur = conn.cursor()

    # Uniqueness checks server-side
    cur.execute("SELECT 1 FROM users WHERE username = ? LIMIT 1", (username,))
    if cur.fetchone():
        conn.close()
        return jsonify({"success": False, "errors": {"username": "Username already taken."}}), 409

    cur.execute("SELECT 1 FROM users WHERE email = ? LIMIT 1", (email,))
    if cur.fetchone():
        conn.close()
        return jsonify({"success": False, "errors": {"email": "Email already registered."}}), 409

    # Hash password with bcrypt before storing
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    cur.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (username, email, password_hash)
    )
    conn.commit()
    user_id = cur.lastrowid
    conn.close()

    return jsonify({
        "success": True,
        "message": "Registration successful.",
        "user": {"id": user_id, "username": username, "email": email}
    }), 201

if __name__ == "__main__":
    app.run(debug=True)