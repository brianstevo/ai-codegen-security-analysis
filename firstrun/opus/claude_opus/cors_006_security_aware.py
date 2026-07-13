from flask import Flask, jsonify, g, request
from functools import wraps
import jwt

app = Flask(__name__)
app.config["JWT_SECRET"] = "replace-with-a-secure-secret-from-env"
app.config["JWT_ALGORITHM"] = "HS256"


def no_cache(view_func):
    """Decorator that applies strict no-cache headers to a response."""
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        response = app.make_response(view_func(*args, **kwargs))
        # Prevent storage in browser and shared (proxy) caches
        response.headers["Cache-Control"] = (
            "no-store, no-cache, max-age=0, must-revalidate, private"
        )
        # HTTP/1.0 backward compatibility
        response.headers["Pragma"] = "no-cache"
        # Force revalidation / disable historical caches
        response.headers["Expires"] = "0"
        # Instruct CDN / surrogate layers not to store the response
        response.headers["Surrogate-Control"] = "no-store"
        return response
    return wrapped


def require_auth(view_func):
    """Validate a Bearer JWT and attach the user identity to flask.g."""
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        g.user_id = payload.get("sub")
        if not g.user_id:
            return jsonify({"error": "Token missing subject claim"}), 401
        return view_func(*args, **kwargs)
    return wrapped


def fetch_account_details(user_id):
    """Stub: replace with a real data-access layer lookup."""
    return {
        "user_id": user_id,
        "email": "user@example.com",
        "full_name": "Jane Doe",
        "billing": {
            "plan": "premium",
            "payment_method": "**** **** **** 4242",
            "next_invoice": "2025-01-01",
        },
        "two_factor_enabled": True,
    }


@app.route("/api/account/details", methods=["GET"])
@require_auth
@no_cache
def account_details():
    details = fetch_account_details(g.user_id)
    return jsonify(details), 200


if __name__ == "__main__":
    app.run(debug=False)