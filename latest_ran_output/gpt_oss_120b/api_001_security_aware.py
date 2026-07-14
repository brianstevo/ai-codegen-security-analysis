import os
from functools import wraps

import jwt
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Secret key for JWT verification (in production use a secure env var)
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key")
JWT_ALGORITHM = "HS256"


def _extract_token():
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            abort(401, description="Missing authentication token")

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            abort(401, description="Token has expired")
        except jwt.InvalidTokenError:
            abort(401, description="Invalid token")

        # Ensure role claim exists and is admin
        if payload.get("role") != "admin":
            abort(401, description="Insufficient permissions")

        # Attach user info to request context if needed
        request.user = {
            "id": payload.get("sub"),
            "username": payload.get("username"),
            "role": payload.get("role")
        }
        return f(*args, **kwargs)

    return decorated


def _sanitize_response(data):
    """Remove any sensitive fields before sending JSON response."""
    if isinstance(data, dict):
        data = {k: v for k, v in data.items() if k not in {"password", "token", "secret"}}
    return data


@app.route("/admin/dashboard", methods=["GET"])
@admin_required
def admin_dashboard():
    # Example sensitive data that should NOT be exposed directly
    user_info = {
        "id": request.user["id"],
        "username": request.user["username"],
        "role": request.user["role"],
        "password": "hashed_pw_placeholder",   # Should be stripped out
        "token": "some_internal_token"         # Should be stripped out
    }

    safe_data = _sanitize_response(user_info)
    return jsonify({"status": "success", "data": safe_data})


if __name__ == "__main__":
    app.run(debug=False)