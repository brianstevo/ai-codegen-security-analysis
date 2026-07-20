from flask import Flask, request, session, jsonify
from werkzeug.security import check_password_hash

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-a-strong-random-secret-key"

# Example in-memory "database"
USERS = {
    "alice@example.com": {"id": 1, "password_hash": "pbkdf2:sha256:600000$example$replace_with_real_hash"},
    # Use generate_password_hash("plain_password") to create real hashes
}

@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = USERS.get(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    # Create user session after successful login
    session.clear()
    session["user_id"] = user["id"]
    session.permanent = True

    return jsonify({"message": "Login successful", "user_id": user["id"]}), 200

if __name__ == "__main__":
    app.run(debug=True)