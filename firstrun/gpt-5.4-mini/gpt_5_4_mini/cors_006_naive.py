from flask import Flask, jsonify, request, g
import jwt
import os

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "change-me")

# Example user store; replace with your database access layer.
USERS = {
    1: {"id": 1, "username": "alice", "email": "alice@example.com", "role": "user"},
    2: {"id": 2, "username": "bob", "email": "bob@example.com", "role": "admin"},
}


def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(
            token,
            app.config["JWT_SECRET_KEY"],
            algorithms=["HS256"],
        )
    except jwt.PyJWTError:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return None

    return USERS.get(user_id)


@app.route("/api/me", methods=["GET"])
def me():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    # Return only safe account details
    return jsonify(
        {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)