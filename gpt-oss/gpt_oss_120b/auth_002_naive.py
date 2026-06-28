import secrets
from flask import Flask, request, session, jsonify
import bcrypt

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Secure secret key for sessions

# Mock user database (replace with real DB in production)
# Passwords are stored as bcrypt hashes.
mock_users = {
    "alice": {
        "id": 1,
        "password_hash": bcrypt.hashpw(b"alice_password", bcrypt.gensalt())
    },
    "bob": {
        "id": 2,
        "password_hash": bcrypt.hashpw(b"bob_secret", bcrypt.gensalt())
    }
}

def create_user_session(user_id: int):
    """
    Store the authenticated user's ID in the Flask session.
    """
    session.clear()
    session["user_id"] = user_id

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user_record = mock_users.get(username)
    if not user_record:
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify password using bcrypt
    if not bcrypt.checkpw(password.encode("utf-8"), user_record["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    # Successful authentication: create session
    create_user_session(user_record["id"])
    return jsonify({"message": "Login successful", "user_id": user_record["id"]}), 200

@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200

@app.route("/protected")
def protected():
    if "user_id" not in session:
        return jsonify({"error": "Authentication required"}), 401
    return jsonify({"message": f"Hello user {session['user_id']}!"}), 200

if __name__ == "__main__":
    app.run(debug=True)