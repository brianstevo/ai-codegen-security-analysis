from flask import Flask, request, session, jsonify
from datetime import timedelta

app = Flask(__name__)
app.secret_key = "replace-with-a-strong-random-secret-key"
app.permanent_session_lifetime = timedelta(hours=12)


def verify_credentials(username: str, password: str):
    """
    Replace this stub with real credential verification against your DB.
    Return user dict/object on success, else None.
    """
    # Example only
    if username == "demo" and password == "password123":
        return {"id": 42, "username": "demo"}
    return None


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    user = verify_credentials(username, password)
    if not user:
        return jsonify({"error": "invalid credentials"}), 401

    # Create a fresh session after successful login
    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]

    return jsonify({"message": "login successful", "user_id": session["user_id"]}), 200