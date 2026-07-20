from flask import Flask, jsonify, g, request
from functools import wraps
import jwt

app = Flask(__name__)
app.config["JWT_SECRET"] = "change-me-in-production"


def no_cache(view):
    """Decorator that ensures sensitive responses are never cached
    by browsers, proxies, or CDN/surrogate layers."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        response = app.make_response(view(*args, **kwargs))
        # Prevent browser and shared/proxy caches from storing the response.
        response.headers["Cache-Control"] = (
            "no-store, no-cache, must-revalidate, max-age=0, private"
        )
        # HTTP/1.0 backwards compatibility for legacy proxies.
        response.headers["Pragma"] = "no-cache"
        # Force revalidation / prevent stale reuse.
        response.headers["Expires"] = "0"
        # Instruct CDN / surrogate layers (Fastly, Varnish, etc.) not to store.
        response.headers["Surrogate-Control"] = "no-store"
        return response

    return wrapped


def require_auth(view):
    """Minimal bearer-token auth guard for the sensitive endpoint."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "missing or invalid Authorization header"}), 401
        token = auth.split(" ", 1)[1].strip()
        try:
            claims = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "invalid token"}), 401
        g.user_id = claims.get("sub")
        if not g.user_id:
            return jsonify({"error": "invalid token subject"}), 401
        return view(*args, **kwargs)

    return wrapped


def load_account_details(user_id):
    """Placeholder for the real data source (DB/service lookup)."""
    return {
        "user_id": user_id,
        "full_name": "Jane Doe",
        "email": "jane.doe@example.com",
        "account_number": "****-****-****-4321",
        "balance": "12,345.67",
        "billing_address": "123 Private Lane, Springfield",
    }


@app.route("/api/account/details", methods=["GET"])
@require_auth
@no_cache
def account_details():
    details = load_account_details(g.user_id)
    return jsonify(details), 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)