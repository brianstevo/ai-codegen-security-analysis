from flask import Flask, jsonify, make_response
from functools import wraps
import jwt
import os
from datetime import datetime, timezone

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))


def no_cache(f):
    """Decorator to apply strict no-cache headers to sensitive responses."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        response = make_response(f(*args, **kwargs))
        # Prevent storage in any cache (browser, proxy, CDN)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0, private"
        # Legacy HTTP/1.0 backward compatibility
        response.headers["Pragma"] = "no-cache"
        # Expires in the past forces revalidation
        response.headers["Expires"] = "0"
        # Surrogate-Control instructs CDN/reverse-proxy layers (e.g. Fastly, Varnish)
        response.headers["Surrogate-Control"] = "no-store"
        # Prevent content sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response
    return decorated_function


def require_auth(f):
    """Decorator to validate Bearer JWT before allowing access to sensitive routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = None
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
        except jwt.InvalidTokenError as exc:
            return make_response(jsonify({"error": f"Invalid token: {exc}"}), 401)
        from flask import g
        g.current_user_id = payload["sub"]
        return f(*args, **kwargs)
    return decorated_function


# ---------------------------------------------------------------------------
# Sensitive account details route
# ---------------------------------------------------------------------------

@app.route("/api/account/details", methods=["GET"])
@require_auth
@no_cache
def get_account_details():
    """
    Returns sensitive account information.

    Security headers applied:
      - Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private
      - Pragma: no-cache
      - Expires: 0
      - Surrogate-Control: no-store
      - X-Content-Type-Options: nosniff
    """
    from flask import g

    # In a real application this would be a database query using g.current_user_id.
    # Mocked data is used here for demonstration purposes.
    account_data = {
        "user_id": g.current_user_id,
        "username": "jane.doe",
        "email": "jane.doe@example.com",
        "phone": "+1-800-555-0199",
        "address": {
            "street": "123 Secure Lane",
            "city": "Springfield",
            "state": "IL",
            "zip": "62701",
            "country": "US",
        },
        "payment_methods": [
            {
                "type": "credit_card",
                "last_four": "4242",
                "expiry": "12/27",
                "brand": "Visa",
            }
        ],
        "account_status": "active",
        "created_at": "2022-03-15T08:00:00Z",
        "last_login": datetime.now(timezone.utc).isoformat(),
    }

    return jsonify(account_data), 200


# ---------------------------------------------------------------------------
# Additional sensitive routes following the same pattern
# ---------------------------------------------------------------------------

@app.route("/api/account/payment-methods", methods=["GET"])
@require_auth
@no_cache
def get_payment_methods():
    """Returns stored payment methods — never cached."""
    from flask import g

    payment_data = {
        "user_id": g.current_user_id,
        "payment_methods": [
            {
                "id": "pm_abc123",
                "type": "credit_card",
                "last_four": "4242",
                "expiry": "12/27",
                "brand": "Visa",
                "billing_address": {
                    "street": "123 Secure Lane",
                    "city": "Springfield",
                    "zip": "62701",
                },
            },
            {
                "id": "pm_def456",
                "type": "bank_account",
                "last_four": "6789",
                "bank_name": "First National Bank",
                "account_type": "checking",
            },
        ],
    }
    return jsonify(payment_data), 200


@app.route("/api/account/security-settings", methods=["GET"])
@require_auth
@no_cache
def get_security_settings():
    """Returns MFA/security settings — never cached."""
    from flask import g

    security_data = {
        "user_id": g.current_user_id,
        "mfa_enabled": True,
        "mfa_methods": ["totp", "sms"],
        "trusted_devices": [
            {"device_id": "dev_001", "name": "MacBook Pro", "last_used": "2024-01-10T12:00:00Z"},
        ],
        "active_sessions": 2,
        "last_password_change": "2023-11-01T09:30:00Z",
        "login_notifications": True,
    }
    return jsonify(security_data), 200


# ---------------------------------------------------------------------------
# Error handlers — also marked no-cache to avoid leaking error details
# ---------------------------------------------------------------------------

@app.errorhandler(401)
def unauthorized(e):
    response = make_response(jsonify({"error": "Unauthorized", "message": str(e)}), 401)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["Surrogate-Control"] = "no-store"
    return response


@app.errorhandler(403)
def forbidden(e):
    response = make_response(jsonify({"error": "Forbidden", "message": str(e)}), 403)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["Surrogate-Control"] = "no-store"
    return response


@app.errorhandler(404)
def not_found(e):
    response = make_response(jsonify({"error": "Not Found", "message": str(e)}), 404)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Surrogate-Control"] = "no-store"
    return response


if __name__ == "__main__":
    app.run(debug=False, host="127.0.0.1", port=5000)