from flask import Flask, jsonify, make_response
from functools import wraps
import jwt
import os
from datetime import datetime, timezone

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))


def no_cache(f):
    """Decorator to apply strict no-cache headers to sensitive endpoints."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        response = make_response(f(*args, **kwargs))
        # Prevent browser and proxy caches from storing the response
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private, max-age=0"
        # Legacy HTTP/1.0 backward compatibility
        response.headers["Pragma"] = "no-cache"
        # Instructs CDN/reverse proxy layers (e.g. Fastly, Varnish) not to store
        response.headers["Surrogate-Control"] = "no-store"
        # Prevent responses from being served from stale cache
        response.headers["Expires"] = "0"
        # Disallow intermediate caches
        response.headers["Vary"] = "*"
        return response

    return decorated_function


def require_auth(f):
    """Decorator to enforce JWT authentication on sensitive routes."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = None

        # Import request here to avoid circular issues in decorator context
        from flask import request

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return make_response(
                jsonify({"error": "Missing or invalid Authorization header"}), 401
            )

        token = auth_header.split(" ", 1)[1]

        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
                options={"require": ["exp", "iat", "sub"]},
            )
        except jwt.ExpiredSignatureError:
            return make_response(jsonify({"error": "Token has expired"}), 401)
        except jwt.InvalidTokenError as e:
            return make_response(jsonify({"error": f"Invalid token: {str(e)}"}), 401)

        from flask import g

        g.current_user_id = payload["sub"]
        return f(*args, **kwargs)

    return decorated_function


def get_account_details(user_id: str) -> dict:
    """
    Simulate fetching sensitive account details from a data store.
    Replace with real database queries in production.
    """
    # Simulated account data — replace with real DB lookup
    accounts = {
        "user_001": {
            "user_id": "user_001",
            "username": "john_doe",
            "email": "john.doe@example.com",
            "phone": "+1-555-867-5309",
            "account_number": "****-****-****-4242",  # masked
            "balance": 15234.78,
            "account_type": "Premium",
            "created_at": "2022-03-15T10:00:00Z",
            "last_login": datetime.now(timezone.utc).isoformat(),
            "two_factor_enabled": True,
            "billing_address": {
                "street": "123 Secure Lane",
                "city": "Springfield",
                "state": "IL",
                "zip": "62701",
                "country": "US",
            },
        }
    }
    return accounts.get(user_id)


@app.route("/api/account/details", methods=["GET"])
@require_auth
@no_cache
def account_details():
    """
    Returns sensitive account information for the authenticated user.
    Responses are strictly prevented from being cached at any layer.
    """
    from flask import g

    user_id = g.current_user_id
    account = get_account_details(user_id)

    if not account:
        return make_response(
            jsonify({"error": "Account not found"}), 404
        )

    return jsonify(
        {
            "status": "success",
            "data": account,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }
    )


@app.route("/api/account/payment-methods", methods=["GET"])
@require_auth
@no_cache
def payment_methods():
    """
    Returns sensitive payment method details.
    Strictly no-cache to protect financial data.
    """
    from flask import g

    user_id = g.current_user_id

    # Simulated payment methods — replace with real DB lookup
    payment_data = {
        "user_id": user_id,
        "payment_methods": [
            {
                "id": "pm_001",
                "type": "credit_card",
                "brand": "Visa",
                "last_four": "4242",
                "expiry": "12/26",
                "is_default": True,
            },
            {
                "id": "pm_002",
                "type": "bank_account",
                "bank_name": "First National Bank",
                "account_last_four": "7890",
                "routing_last_four": "0021",
                "is_default": False,
            },
        ],
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }

    return jsonify({"status": "success", "data": payment_data})


@app.route("/api/account/security-settings", methods=["GET"])
@require_auth
@no_cache
def security_settings():
    """
    Returns sensitive security settings and audit log.
    Must never be cached due to sensitivity.
    """
    from flask import g

    user_id = g.current_user_id

    # Simulated security settings — replace with real DB lookup
    security_data = {
        "user_id": user_id,
        "two_factor_auth": {
            "enabled": True,
            "method": "authenticator_app",
            "backup_codes_remaining": 6,
        },
        "active_sessions": [
            {
                "session_id": "sess_abc123",
                "ip_address": "192.168.1.100",
                "device": "Chrome on macOS",
                "last_active": "2024-01-10T14:30:00Z",
                "is_current": True,
            }
        ],
        "recent_login_attempts": [
            {
                "timestamp": "2024-01-10T14:30:00Z",
                "ip_address": "192.168.1.100",
                "status": "success",
                "location": "Springfield, IL, US",
            },
            {
                "timestamp": "2024-01-09T09:15:00Z",
                "ip_address": "10.0.0.55",
                "status": "failed",
                "location": "Unknown",
            },
        ],
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }

    return jsonify({"status": "success", "data": security_data})


@app.errorhandler(404)
def not_found(e):
    response = make_response(jsonify({"error": "Resource not found"}), 404)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.errorhandler(500)
def internal_error(e):
    response = make_response(jsonify({"error": "Internal server error"}), 500)
    response.headers["Cache-Control"] = "no-store"
    return response


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)