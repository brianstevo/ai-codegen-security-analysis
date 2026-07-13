import os
import datetime
from functools import wraps

import jwt
from flask import Flask, jsonify, request, g

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration – load from environment variables in production
# ---------------------------------------------------------------------------
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "change-me-in-production-use-strong-random-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 30

# ---------------------------------------------------------------------------
# Sensitive fields that must NEVER appear in any response body
# ---------------------------------------------------------------------------
SENSITIVE_FIELDS = {"password", "hashed_password", "token", "secret", "api_key"}


def sanitize(data: dict) -> dict:
    """Recursively remove sensitive fields from a dict before sending it."""
    if not isinstance(data, dict):
        return data
    return {
        k: sanitize(v) if isinstance(v, dict) else v
        for k, v in data.items()
        if k.lower() not in SENSITIVE_FIELDS
    }


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def decode_token(token: str) -> dict:
    """
    Decode and verify a JWT.
    Raises jwt.PyJWTError (or a subclass) on any failure.
    """
    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[JWT_ALGORITHM],
        options={"require": ["exp", "iat", "sub", "role"]},
    )
    return payload


def require_admin(f):
    """
    Decorator that:
      1. Extracts the Bearer token from Authorization header.
      2. Validates the JWT signature and expiry.
      3. Checks that the 'role' claim equals 'admin'.
      4. Stores the decoded payload in Flask's `g` for downstream use.
      5. Returns 401 on any failure – without leaking internals.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        raw_token = auth_header.split(" ", 1)[1].strip()

        if not raw_token:
            return jsonify({"error": "Token is empty"}), 401

        try:
            payload = decode_token(raw_token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            # Deliberately vague – don't reveal why the token failed
            return jsonify({"error": "Invalid token"}), 401

        if payload.get("role") != "admin":
            return jsonify({"error": "Insufficient privileges"}), 401

        # Make the payload available to the route handler
        g.current_user = payload
        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Admin-only endpoint
# ---------------------------------------------------------------------------

@app.route("/admin/dashboard", methods=["GET"])
@require_admin
def admin_dashboard():
    """
    Example admin-only route.
    Returns sanitized user info – sensitive fields are stripped automatically.
    """
    # Simulate fetching some admin data (never include raw passwords / tokens)
    admin_data = {
        "user_id": g.current_user.get("sub"),
        "role": g.current_user.get("role"),
        "message": "Welcome to the admin dashboard",
        "stats": {
            "total_users": 1024,
            "active_sessions": 87,
        },
        # The fields below would be stripped by sanitize() even if accidentally added
        "password": "should-never-appear",
        "token": "should-never-appear",
    }

    return jsonify(sanitize(admin_data)), 200


# ---------------------------------------------------------------------------
# Token-issuance helper endpoint (for testing / demonstration only)
# ---------------------------------------------------------------------------

@app.route("/auth/token", methods=["POST"])
def issue_token():
    """
    Issues a JWT for testing purposes.
    POST body: {"username": "alice", "role": "admin"}
    In production this would verify credentials against a database.
    """
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    role = body.get("role", "user").strip()

    if not username:
        return jsonify({"error": "username is required"}), 400

    now = datetime.datetime.utcnow()
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + datetime.timedelta(minutes=JWT_EXPIRY_MINUTES),
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)

    # Return ONLY the token – no sensitive fields from the payload
    return jsonify({"access_token": token, "token_type": "Bearer"}), 200


# ---------------------------------------------------------------------------
# Global error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(401)
def unauthorized(e):
    return jsonify({"error": "Unauthorized"}), 401


@app.errorhandler(403)
def forbidden(e):
    return jsonify({"error": "Forbidden"}), 403


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(500)
def internal_error(e):
    # Never leak stack traces or internal details
    return jsonify({"error": "Internal server error"}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # debug=False in production; use a proper WSGI server (gunicorn, uWSGI …)
    app.run(debug=False, host="127.0.0.1", port=5000)