import functools
import jwt
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["JWT_SECRET"] = "change-this-to-a-secure-secret-loaded-from-env"
app.config["JWT_ALGORITHM"] = "HS256"

# --- Mock data store (replace with your real DB access) ---
USERS = {
    1: {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com",
        "role": "user",
        "full_name": "Alice Anderson",
        # sensitive fields below must never be returned
        "password_hash": "$2b$12$abcdefghijklmnopqrstuv",
        "mfa_secret": "JBSWY3DPEHPK3PXP",
        "session_token": "s3cr3t-session",
        "reset_token": "reset-xyz",
    },
    2: {
        "id": 2,
        "username": "bob",
        "email": "bob@example.com",
        "role": "admin",
        "full_name": "Bob Brown",
        "password_hash": "$2b$12$zyxwvutsrqponmlkjihgfe",
        "mfa_secret": "KRSXG5CTMVRXEZLU",
        "session_token": "s3cr3t-session-2",
        "reset_token": "reset-abc",
    },
}

# Fields that must be stripped before sending any user object to a client.
SENSITIVE_FIELDS = {
    "password_hash",
    "password",
    "mfa_secret",
    "session_token",
    "reset_token",
    "api_key",
    "private_key",
}


def get_user_by_id(user_id):
    return USERS.get(user_id)


def sanitize_user(user):
    """Return a copy of the user dict with sensitive fields removed."""
    return {k: v for k, v in user.items() if k not in SENSITIVE_FIELDS}


def _extract_token():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[len("Bearer "):].strip()
    return None


def require_auth(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_token()

        # Fall back to a server-side session if no bearer token present.
        if not token:
            # Example: integrate with Flask-Login / session here.
            from flask import session
            uid = session.get("user_id")
            if not uid:
                return jsonify({"error": "authentication required"}), 401
            user = get_user_by_id(uid)
            if not user:
                return jsonify({"error": "invalid session"}), 401
            g.current_user = user
            return fn(*args, **kwargs)

        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "invalid token"}), 401

        uid = payload.get("sub")
        if uid is None:
            return jsonify({"error": "invalid token payload"}), 401

        try:
            uid = int(uid)
        except (TypeError, ValueError):
            return jsonify({"error": "invalid token subject"}), 401

        user = get_user_by_id(uid)
        if not user:
            return jsonify({"error": "user not found"}), 401

        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


@app.route("/api/users/<int:user_id>", methods=["GET"])
@require_auth
def get_user_account(user_id):
    current = g.current_user
    is_admin = current.get("role") == "admin"
    is_self = current.get("id") == user_id

    # Enforce ownership: only self or admin may access.
    if not (is_self or is_admin):
        # Return 404 (not 403) to avoid leaking existence of other accounts.
        return jsonify({"error": "not found"}), 404

    target = get_user_by_id(user_id)
    if not target:
        return jsonify({"error": "not found"}), 404

    return jsonify(sanitize_user(target)), 200


if __name__ == "__main__":
    app.run(debug=False)