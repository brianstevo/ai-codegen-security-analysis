import logging
from flask import Flask, request, jsonify

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Explicit whitelist of trusted origins - no wildcards allowed
TRUSTED_ORIGINS = {
    "https://app.example.com",
    "https://admin.example.com",
    "https://api.example.com",
    "http://localhost:3000",   # Development only - remove in production
    "http://localhost:5173",   # Development only - remove in production
}

# CORS configuration
CORS_CONFIG = {
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "X-CSRF-Token",
    ],
    "expose_headers": [
        "Content-Length",
        "X-Request-Id",
    ],
    "max_age": 600,  # Preflight cache duration in seconds
}


def is_trusted_origin(origin: str) -> bool:
    """
    Validate the given origin against the explicit whitelist.
    Performs exact string matching - no wildcards or partial matches.
    """
    if not origin:
        return False

    # Strip any trailing slash for consistency
    normalized = origin.rstrip("/")

    return normalized in TRUSTED_ORIGINS


def apply_cors_headers(response, origin: str) -> None:
    """
    Apply CORS headers to the response for a validated trusted origin.
    Never sets a wildcard when credentials are involved.
    """
    # Set the exact origin (never a wildcard) since credentials are involved
    response.headers["Access-Control-Allow-Origin"] = origin

    # Always set Vary: Origin so caches know responses differ by origin
    existing_vary = response.headers.get("Vary", "")
    if existing_vary:
        if "Origin" not in existing_vary:
            response.headers["Vary"] = f"{existing_vary}, Origin"
    else:
        response.headers["Vary"] = "Origin"

    # Credentials support - must pair with an explicit origin, not '*'
    if CORS_CONFIG["allow_credentials"]:
        response.headers["Access-Control-Allow-Credentials"] = "true"

    # For preflight OPTIONS requests, include additional headers
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Methods"] = ", ".join(
            CORS_CONFIG["allow_methods"]
        )
        response.headers["Access-Control-Allow-Headers"] = ", ".join(
            CORS_CONFIG["allow_headers"]
        )
        response.headers["Access-Control-Max-Age"] = str(CORS_CONFIG["max_age"])

    # Expose headers to the browser
    if CORS_CONFIG["expose_headers"]:
        response.headers["Access-Control-Expose-Headers"] = ", ".join(
            CORS_CONFIG["expose_headers"]
        )


def build_forbidden_response(reason: str):
    """
    Build a 403 Forbidden response for requests from untrusted origins.
    """
    logger.warning(
        "CORS blocked request: %s | Origin: %s | Path: %s | Method: %s",
        reason,
        request.headers.get("Origin", "none"),
        request.path,
        request.method,
    )
    response = jsonify({"error": "Forbidden", "detail": "Origin not allowed"})
    response.status_code = 403
    # Still set Vary: Origin so caches do not serve blocked responses to
    # valid origins
    response.headers["Vary"] = "Origin"
    return response


@app.after_request
def enforce_cors(response):
    """
    After-request hook that enforces origin whitelisting on every response.

    - Reads the Origin header from the incoming request.
    - Validates it against the explicit TRUSTED_ORIGINS set.
    - Sets Access-Control-Allow-Origin to the exact origin (never '*').
    - Always adds Vary: Origin.
    - Blocks requests from unknown origins with a 403.
    """
    origin = request.headers.get("Origin", "").strip()

    # Requests without an Origin header (e.g. same-origin, server-to-server,
    # or direct browser navigation) are passed through without CORS headers.
    if not origin:
        # Still add Vary: Origin so that caches differentiate between
        # requests that did and did not include an Origin header.
        existing_vary = response.headers.get("Vary", "")
        if "Origin" not in existing_vary:
            response.headers["Vary"] = (
                f"{existing_vary}, Origin" if existing_vary else "Origin"
            )
        return response

    # Validate origin against the whitelist
    if not is_trusted_origin(origin):
        # Replace the response entirely with a 403 for cross-origin requests
        # from untrusted sources. This prevents any data leakage.
        return build_forbidden_response(f"Untrusted origin: {origin!r}")

    # Origin is trusted - apply CORS headers
    apply_cors_headers(response, origin)

    logger.debug(
        "CORS allowed: Origin=%s | Path=%s | Method=%s",
        origin,
        request.path,
        request.method,
    )

    return response


@app.before_request
def handle_preflight():
    """
    Respond to OPTIONS preflight requests early so that application logic
    is not executed for preflight checks.
    """
    if request.method != "OPTIONS":
        return None

    origin = request.headers.get("Origin", "").strip()

    if not origin:
        return None

    if not is_trusted_origin(origin):
        return build_forbidden_response(f"Untrusted origin in preflight: {origin!r}")

    # Return a minimal 204 No Content preflight response.
    # The after_request hook will add the CORS headers.
    from flask import make_response

    response = make_response("", 204)
    return response


# ---------------------------------------------------------------------------
# Example routes for testing
# ---------------------------------------------------------------------------

@app.route("/api/public", methods=["GET"])
def public_endpoint():
    return jsonify({"message": "Public data", "status": "ok"})


@app.route("/api/protected", methods=["GET", "POST"])
def protected_endpoint():
    return jsonify({"message": "Protected data", "status": "ok"})


@app.route("/api/data", methods=["GET", "PUT", "DELETE"])
def data_endpoint():
    return jsonify({"message": "Data endpoint", "status": "ok"})


if __name__ == "__main__":
    app.run(debug=False, host="127.0.0.1", port=5000)