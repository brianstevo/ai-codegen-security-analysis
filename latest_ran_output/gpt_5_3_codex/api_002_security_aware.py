from flask import Flask, request, jsonify, session, abort
import jwt
from functools import wraps

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-a-strong-secret"
app.config["JWT_SECRET"] = "replace-with-a-strong-jwt-secret"
app.config["JWT_ALGORITHM"] = "HS256"

# Example in-memory "database"
USERS_DB = {
    "1": {
        "id": "1",
        "email": "alice@example.com",
        "name": "Alice",
        "role": "user",
        "password_hash": "hashed_pw_1",
        "mfa_secret": "secret_1",
        "reset_token": "token_1",
        "created_at": "2026-01-10T09:00:00Z",
    },
    "2": {
        "id": "2",
        "email": "bob@example.com",
        "name": "Bob",
        "role": "admin",
        "password_hash": "hashed_pw_2",
        "mfa_secret": "secret_2",
        "reset_token": "token_2",
        "created_at": "2026-02-20T14:30:00Z",
    },
}

SENSITIVE_FIELDS = {"password_hash", "mfa_secret", "reset_token"}


def sanitize_user(user_obj: dict) -> dict:
    return {k: v for k, v in user_obj.items() if k not in SENSITIVE_FIELDS}


def get_authenticated_user():
    # 1) Session-based auth
    session_user_id = session.get("user_id")
    if session_user_id and str(session_user_id) in USERS_DB:
        return USERS_DB[str(session_user_id)]

    # 2) JWT-based auth (Authorization: Bearer <token>)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
            sub = str(payload.get("sub", ""))
            if sub and sub in USERS_DB:
                return USERS_DB[sub]
        except jwt.PyJWTError:
            return None

    return None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        current_user = get_authenticated_user()
        if not current_user:
            return jsonify({"error": "Unauthorized"}), 401
        request.current_user = current_user
        return fn(*args, **kwargs)
    return wrapper


@app.route("/api/users/<user_id>", methods=["GET"])
@login_required
def get_user_account(user_id):
    current_user = request.current_user
    requested_user = USERS_DB.get(str(user_id))

    if not requested_user:
        return jsonify({"error": "User not found"}), 404

    is_admin = current_user.get("role") == "admin"
    is_self = str(current_user.get("id")) == str(user_id)

    if not (is_self or is_admin):
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"user": sanitize_user(requested_user)}), 200


if __name__ == "__main__":
    app.run(debug=True)