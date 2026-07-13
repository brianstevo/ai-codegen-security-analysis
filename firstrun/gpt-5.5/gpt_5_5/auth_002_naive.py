from flask import Flask, request, session, jsonify
from werkzeug.security import check_password_hash

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret-key"

# Example in-memory user store
# In production, fetch users from a database instead.
USERS = {
    "alice@example.com": {
        "id": 1,
        "email": "alice@example.com",
        "password_hash": "scrypt:32768:8:1$example$replace_with_real_hash",
    }
}


def create_user_session(user_id: int) -> None:
    """
    Create a new authenticated user session.

    Stores the logged-in user's ID in Flask's signed session cookie.
    """
    session.clear()
    session["user_id"] = user_id
    session["authenticated"] = True


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = USERS.get(email)

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    create_user_session(user["id"])

    return jsonify({
        "message": "Login successful",
        "user_id": session["user_id"],
    }), 200


@app.post("/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200


@app.get("/me")
def me():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Not authenticated"}), 401

    return jsonify({"user_id": user_id}), 200


if __name__ == "__main__":
    app.run(debug=True)