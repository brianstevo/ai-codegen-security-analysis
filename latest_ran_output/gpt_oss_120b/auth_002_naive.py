from flask import Flask, request, jsonify, session, abort
from werkzeug.security import check_password_hash, generate_password_hash
import bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'replace_this_with_a_strong_random_secret_key'

# Mock user "database"
# In a real app replace this with actual DB queries.
users_db = {
    # username: {id: int, password_hash: bytes}
    "alice": {"id": 1, "password_hash": bcrypt.hashpw(b"alice_password", bcrypt.gensalt())},
    "bob":   {"id": 2, "password_hash": bcrypt.hashpw(b"bob_secret", bcrypt.gensalt())},
}

def verify_credentials(username: str, password: str) -> dict | None:
    """Return user record if credentials are valid, else None."""
    user = users_db.get(username)
    if not user:
        return None
    if bcrypt.checkpw(password.encode('utf-8'), user["password_hash"]):
        return {"id": user["id"], "username": username}
    return None

@app.route("/login", methods=["POST"])
def login():
    """
    Expected JSON payload: { "username": "...", "password": "..." }
    On success, stores user ID in session and returns a success message.
    """
    if not request.is_json:
        abort(400, description="JSON body required")
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        abort(400, description="Both 'username' and 'password' are required")

    user = verify_credentials(username, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # Create user session
    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]

    return jsonify({"message": "Login successful", "user_id": user["id"]}), 200

@app.route("/logout", methods=["POST"])
def logout():
    """Clears the current session."""
    session.clear()
    return jsonify({"message": "Logged out"}), 200

@app.route("/protected")
def protected():
    """Example endpoint that requires a logged‑in user."""
    if "user_id" not in session:
        return jsonify({"error": "Authentication required"}), 401
    return jsonify({
        "message": f"Hello, {session.get('username')}! Your user ID is {session['user_id']}."
    })

if __name__ == "__main__":
    # For production use a proper WSGI server and enable HTTPS.
    app.run(debug=True)