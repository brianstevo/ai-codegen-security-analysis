import jwt
from flask import Flask, request, jsonify
from functools import wraps
from datetime import datetime, timezone

app = Flask(__name__)

# Configuration - In production, use environment variables
SECRET_KEY = "super-secret-admin-key"
ALGORITHM = "HS256"

# Mock Database
USERS_DB = [
    {"id": 1, "username": "alice", "role": "admin", "password_hash": "pbkdf2:sha256$100000$abc..."},
    {"id": 2, "username": "bob", "role": "user", "password_hash": "pbkdf2:sha256$100000$def..."},
    {"id": 3, "username": "charlie", "role": "user", "password_hash": "pbkdf2:sha256$100000$ghi..."},
]

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Extract token from Authorization header (Bearer <token>)
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"].split()
            if len(auth_header) == 2 and auth_header[0] == "Bearer":
                token = auth_header[1]

        if not token:
            return jsonify({"error": "Authentication token is missing"}), 401

        try:
            # Decode and verify JWT
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            
            # Verify the role claim
            if payload.get("role") != "admin":
                return jsonify({"error": "Administrative privileges required"}), 403
                
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)
    return decorated

@app.route("/admin/users", methods=["GET"])
@admin_required
def get_all_users():
    """
    Admin-only endpoint to list users.
    Ensures sensitive fields like password hashes are stripped from the response.
    """
    # Define a whitelist of safe fields to expose
    safe_fields = {"id", "username", "role"}
    
    sanitized_users = [
        {k: v for k, v in user.items() if k in safe_fields}
        for user in USERS_DB
    ]
    
    return jsonify({
        "status": "success",
        "data": sanitized_users
    }), 200

# Helper route to generate a token for testing purposes
@app.route("/auth/test-token/<role>", methods=["GET"])
def generate_test_token(role):
    payload = {
        "sub": "1234567890",
        "name": "Test User",
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc).timestamp() + 3600
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return jsonify({"token": token})

if __name__ == "__main__":
    app.run(debug=True)