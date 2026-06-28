import os
import datetime
from functools import wraps

from flask import Flask, request, jsonify, g, abort
import bcrypt
import jwt

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("JWT_SECRET", "super-secret-key")
app.config["JWT_ALGORITHM"] = "HS256"
app.config["JWT_EXP_DELTA_SECONDS"] = 3600

# ---- Mock user store -------------------------------------------------------
# In a real app this would be a database model.
USERS = {
    # id: user dict
    1: {
        "id": 1,
        "username": "alice",
        "password_hash": bcrypt.hashpw(b"alicepwd", bcrypt.gensalt()).decode(),
        "email": "alice@example.com",
        "role": "user",
        "ssn": "123-45-6789",          # sensitive
        "created_at": "2023-01-01T12:00:00Z"
    },
    2: {
        "id": 2,
        "username": "bob",
        "password_hash": bcrypt.hashpw(b"bobpwd", bcrypt.gensalt()).decode(),
        "email": "bob@example.com",
        "role": "admin",
        "ssn": "987-65-4321",
        "created_at": "2023-02-15T08:30:00Z"
    },
}


def get_user_by_id(user_id):
    return USERS.get(user_id)


def get_user_by_username(username):
    for user in USERS.values():
        if user["username"] == username:
            return user
    return None


# ---- JWT utilities ---------------------------------------------------------
def generate_jwt(payload):
    exp = datetime.datetime.utcnow() + datetime.timedelta(
        seconds=app.config["JWT_EXP_DELTA_SECONDS"]
    )
    payload.update({"exp": exp})
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm=app.config["JWT_ALGORITHM"])
    # PyJWT returns str in >=2.0, bytes in <2.0
    return token if isinstance(token, str) else token.decode()


def decode_jwt(token):
    try:
        payload = jwt.decode(
            token,
            app.config["SECRET_KEY"],
            algorithms=[app.config["JWT_ALGORITHM"]],
        )
        return payload
    except jwt.ExpiredSignatureError:
        abort(401, description="Token has expired")
    except jwt.InvalidTokenError:
        abort(401, description="Invalid token")


def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        parts = auth.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            abort(401, description="Missing or malformed Authorization header")
        token = parts[1]
        payload = decode_jwt(token)
        user = get_user_by_id(payload.get("user_id"))
        if not user:
            abort(401, description="User not found")
        g.current_user = user
        return f(*args, **kwargs)

    return decorated


# ---- Routes -----------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    """
    Expects JSON: {"username": "...", "password": "..."}
    Returns JWT on success.
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        abort(400, description="Username and password required")

    user = get_user_by_username(username)
    if not user:
        abort(401, description="Invalid credentials")

    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        abort(401, description="Invalid credentials")

    token = generate_jwt({"user_id": user["id"], "role": user["role"]})
    return jsonify({"access_token": token})


@app.route("/account/<int:user_id>", methods=["GET"])
@jwt_required
def get_account(user_id):
    """
    Returns account data for the requested user.
    - Regular users can only fetch their own record.
    - Admins can fetch any user's record.
    Sensitive fields are stripped from the response.
    """
    requester = g.current_user

    # Authorization check
    if requester["role"] != "admin" and requester["id"] != user_id:
        abort(403, description="Forbidden: cannot access other users' data")

    target_user = get_user_by_id(user_id)
    if not target_user:
        abort(404, description="User not found")

    # Prepare safe copy
    safe_user = {k: v for k, v in target_user.items() if k not in {"password_hash", "ssn"}}
    return jsonify(safe_user)


# ---- Run --------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True)