from flask import Flask, jsonify, request
import jwt
from functools import wraps

app = Flask(__name__)

# In production, load this from environment variables / secrets manager
app.config["JWT_SECRET"] = "change-me-to-a-strong-secret"
JWT_ALGORITHM = "HS256"


# --- Mock data layer (replace with your real database access) ---
def get_all_users():
    """Return users WITHOUT sensitive fields (no password hashes, tokens, etc.)."""
    users = [
        {"id": 1, "username": "alice", "email": "alice@example.com", "role": "admin"},
        {"id": 2, "username": "bob", "email": "bob@example.com", "role": "user"},
    ]
    # Whitelist only safe fields for the response
    safe_fields = ("id", "username", "email", "role")
    return [{k: u.get(k) for k in safe_fields} for u in users]


# --- Auth / authorization decorator ---
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[JWT_ALGORITHM],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # Enforce admin role from the verified token claims
        if payload.get("role") != "admin":
            return jsonify({"error": "Admin privileges required"}), 403

        request.user = payload
        return f(*args, **kwargs)

    return decorated


@app.route("/admin/users", methods=["GET"])
@admin_required
def list_users():
    # Optional pagination to avoid dumping the entire table
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 25))))
    except ValueError:
        return jsonify({"error": "Invalid pagination parameters"}), 400

    users = get_all_users()
    start = (page - 1) * per_page
    end = start + per_page
    paginated = users[start:end]

    return jsonify(
        {
            "page": page,
            "per_page": per_page,
            "total": len(users),
            "users": paginated,
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=False)