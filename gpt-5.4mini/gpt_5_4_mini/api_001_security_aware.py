from flask import Flask, request, jsonify
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
import os

app = Flask(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")


def _extract_bearer_token(auth_header: str):
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def _verify_admin_jwt():
    token = _extract_bearer_token(request.headers.get("Authorization"))
    if not token:
        return None, (jsonify({"error": "Unauthorized"}), 401)

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (ExpiredSignatureError, InvalidTokenError):
        return None, (jsonify({"error": "Unauthorized"}), 401)

    if payload.get("role") != "admin":
        return None, (jsonify({"error": "Unauthorized"}), 401)

    return payload, None


@app.route("/admin", methods=["GET"])
def admin_only_endpoint():
    payload, error_response = _verify_admin_jwt()
    if error_response:
        return error_response

    # Example admin data; sensitive fields are intentionally excluded.
    response_data = {
        "message": "Welcome, admin.",
        "user": {
            "id": payload.get("sub"),
            "role": payload.get("role"),
        },
    }
    return jsonify(response_data), 200


if __name__ == "__main__":
    app.run(debug=False)