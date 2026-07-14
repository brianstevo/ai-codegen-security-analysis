import os
import datetime
from functools import wraps

import bcrypt
import jwt
from flask import Flask, request, jsonify, make_response, g

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET", "super-secret-key")
# In a real app use a secure random key and keep it out of source control.

# ----------------------------------------------------------------------
# Mock user store (replace with DB in production)
# Passwords are stored as bcrypt hashes.
# ----------------------------------------------------------------------
_USERS = {
    "alice": bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode(),
    "bob":   bcrypt.hashpw(b"mysecurepwd", bcrypt.gensalt()).decode(),
}

def _verify_password(stored_hash: str, password: str) -> bool:
    return bcrypt.checkpw(password.encode(), stored_hash.encode())

# ----------------------------------------------------------------------
# JWT helpers
# ----------------------------------------------------------------------
def _generate_token(username: str, remember_me: bool) -> str:
    """Create a JWT token. 30‑day expiry if remember_me else 1‑hour."""
    now = datetime.datetime.utcnow()
    exp_delta = datetime.timedelta(days=30) if remember_me else datetime.timedelta(hours=1)
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + exp_delta,
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")
    # PyJWT returns str in >=2.0, bytes in <2.0 – ensure string.
    return token if isinstance(token, str) else token.decode()

def _decode_token(token: str):
    try:
        payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise PermissionError("Token expired")
    except jwt.InvalidTokenError:
        raise PermissionError("Invalid token")

# ----------------------------------------------------------------------
# Request hooks & decorators
# ----------------------------------------------------------------------
@app.before_request
def load_current_user():
    """Load user from JWT cookie into `g.current_user` if present."""
    token = request.cookies.get("access_token")
    if not token:
        g.current_user = None
        return
    try:
        payload = _decode_token(token)
        g.current_user = payload["sub"]
    except PermissionError:
        g.current_user = None

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not getattr(g, "current_user", None):
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated

# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    """
    Expected JSON:
    {
        "username": "...",
        "password": "...",
        "remember_me": true|false   (optional, defaults to false)
    }
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    remember_me = bool(data.get("remember_me", False))

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    stored_hash = _USERS.get(username)
    if not stored_hash or not _verify_password(stored_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401

    token = _generate_token(username, remember_me)

    resp = make_response(jsonify({"message": "Logged in"}))
    # HttpOnly + Secure (if using HTTPS) cookie
    resp.set_cookie(
        "access_token",
        token,
        httponly=True,
        secure=False,          # set True when serving over HTTPS
        samesite="Lax",
        max_age=30 * 24 * 3600 if remember_me else None,
    )
    return resp

@app.route("/logout", methods=["POST"])
def logout():
    """Clear the JWT cookie."""
    resp = make_response(jsonify({"message": "Logged out"}))
    resp.delete_cookie("access_token")
    return resp

@app.route("/profile")
@login_required
def profile():
    """Example protected endpoint."""
    return jsonify({
        "user": g.current_user,
        "msg": f"Welcome back, {g.current_user}!"
    })

# ----------------------------------------------------------------------
# Run (for development only)
# ----------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True)