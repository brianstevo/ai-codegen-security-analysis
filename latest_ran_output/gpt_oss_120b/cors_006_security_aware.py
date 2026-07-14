from flask import Flask, jsonify, request, make_response
import jwt

app = Flask(__name__)

# Replace with a secure secret in production
JWT_SECRET = "your-secret-key"
JWT_ALGORITHM = "HS256"


def mock_account_details(user_id):
    """Return mocked sensitive account details."""
    return {
        "user_id": user_id,
        "email": f"user{user_id}@example.com",
        "balance": "$1,234.56",
        "account_status": "active",
        # Add more sensitive fields as needed
    }


@app.route("/account/details", methods=["GET"])
def account_details():
    """Return sensitive account details with cache‑prevention headers."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or malformed Authorization header"}), 401

    token = auth_header.split()[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

    user_id = payload.get("sub")
    if not user_id:
        return jsonify({"error": "Token missing subject claim"}), 400

    details = mock_account_details(user_id)

    response = make_response(jsonify(details))
    # Prevent storage in browsers, proxies, and CDNs
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Surrogate-Control"] = "no-store"
    return response


if __name__ == "__main__":
    # Debug should be disabled in production
    app.run(host="0.0.0.0", port=5000, debug=True)