from datetime import timedelta
from flask import Flask, session, request, jsonify
from werkzeug.security import check_password_hash

app = Flask(__name__)

app.secret_key = "replace-this-with-a-secure-random-secret-key"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)


users = {
    "alice@example.com": {
        "id": 1,
        "email": "alice@example.com",
        "password_hash": "scrypt:32768:8:1$example$replace_with_real_hash",
    }
}


def create_user_session(user_id: int) -> None:
    session.clear()
    session.permanent = True
    session["user_id"] = user_id


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users.get(email)

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