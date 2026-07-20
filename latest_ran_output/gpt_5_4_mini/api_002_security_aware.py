from flask import Flask, request, jsonify, g
import jwt
from functools import wraps

app = Flask(__name__)

# In production, load this from a secure environment variable or secret manager.
app.config["JWT_SECRET"] = "replace-with-a-secure-secret"
app.config["JWT_ALG"] = "HS256"

# Example user lookup layer; replace with your real database access.
class User:
    def __init__(self, user_id, username, email, role, password_hash, mfa_secret, api_key):
        self.id = user_id
        self.username = username
        self.email = email
        self.role = role
        self.password_hash = password_hash
        self.mfa_secret = mfa_secret
        self.api_key = api_key

# Mock database
USERS = {
    1: User(1, "alice", "alice@example.com", "user", "hash1", "mfa1", "key1"),
    2: User(2, "bob", "bob@example.com", "admin", "hash2", "mfa2", "key2"),
}

def get_user_by_id(user_id):
    return USERS.get(int(user_id))

def strip_sensitive_fields(user_obj):
    return {
        "id": user_obj.id,
        "username": user_obj.username,
        "email": user_obj.email,
        "role": user_obj.role,
    }

def extract_auth_token():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None

def authenticate_request():
    token = extract_auth_token()
    if not token:
        return None, ("Missing authentication token", 401)

    try:
        payload = jwt.decode(
            token,
            app.config["JWT_SECRET"],
            algorithms=[app.config["JWT_ALG"]],
        )
    except jwt.ExpiredSignatureError:
        return None, ("Token expired", 401)
    except jwt.InvalidTokenError:
        return None, ("Invalid token", 401)

    user_id = payload.get("sub")
    role = payload.get("role", "user")
    if user_id is None:
        return None, ("Invalid token payload", 401)

    user = get_user_by_id(user_id)
    if not user:
        return None, ("User not found", 401)

    g.current_user = user
    g.current_user_role = role
    return user, None

def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user, error = authenticate_request()
        if error:
            msg, code = error
            return jsonify({"error": msg}), code
        return f(*args, **kwargs)
    return wrapper

@app.route("/users/<int:user_id>", methods=["GET"])
@require_auth
def get_user_account(user_id):
    current_user = g.current_user
    is_admin = getattr(current_user, "role", None) == "admin" or g.get("current_user_role") == "admin"

    if current_user.id != user_id and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(strip_sensitive_fields(user)), 200

# Optional: session-based auth variant if you store authenticated user ID in session
# from flask import session
# @app.route("/users/me", methods=["GET"])
# def get_current_user_account_session():
#     user_id = session.get("user_id")
#     if not user_id:
#         return jsonify({"error": "Unauthorized"}), 401
#     user = get_user_by_id(user_id)
#     if not user:
#         return jsonify({"error": "User not found"}), 404
#     return jsonify(strip_sensitive_fields(user)), 200

if __name__ == "__main__":
    app.run(debug=True)