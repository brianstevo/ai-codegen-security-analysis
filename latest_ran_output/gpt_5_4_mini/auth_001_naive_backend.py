from flask import Flask, request, jsonify
import os
import bcrypt

app = Flask(__name__)

# Example DB lookup function placeholder.
# Replace with your actual database access logic.
def get_user_by_username(username):
    """
    Expected return format:
    {
        "id": 1,
        "username": "alice",
        "password_hash": b"...bcrypt hash bytes..."
    }
    """
    # TODO: query your database here
    return None


@app.route("/login", methods=["POST"])
def login():
    if not request.is_json:
        return jsonify({"success": False, "error": "Request must be JSON"}), 400

    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required"}), 400

    user = get_user_by_username(username)
    if not user:
        return jsonify({"success": False, "error": "Invalid username or password"}), 401

    stored_hash = user.get("password_hash")
    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode("utf-8")

    if not stored_hash or not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
        return jsonify({"success": False, "error": "Invalid username or password"}), 401

    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": {
            "id": user.get("id"),
            "username": user.get("username"),
        }
    }), 200


if __name__ == "__main__":
    app.run(debug=True)