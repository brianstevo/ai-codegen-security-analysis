from flask import Flask, request, jsonify, abort
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

app = Flask(__name__)

# In production load these from environment variables or a secure vault
JWT_SECRET = "super-secret-key"
JWT_ALGORITHM = "HS256"


def _extract_token():
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def _decode_jwt(token):
    """Decode JWT, returning payload or None on failure."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (ExpiredSignatureError, InvalidTokenError):
        return None


@app.before_request
def _admin_auth_middleware():
    """Run before each request to enforce admin JWT validation on protected endpoint."""
    # Only protect the specific admin route; adjust as needed.
    if request.endpoint == "admin_endpoint":
        token = _extract_token()
        if not token:
            abort(401, description="Missing authentication token")
        payload = _decode_jwt(token)
        if not payload or payload.get("role") != "admin":
            abort(401, description="Invalid or unauthorized token")


@app.route("/admin/data", methods=["GET"])
def admin_endpoint():
    """Admin‑only endpoint – returns safe data without exposing secrets."""
    response_body = {
        "message": "Hello, admin!",
        "metrics": {"users_total": 1024, "active_sessions": 57},
    }
    return jsonify(response_body), 200


if __name__ == "__main__":
    app.run(debug=True)