import logging
from flask import Flask, request, abort

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Explicit whitelist of trusted origins — no wildcards
TRUSTED_ORIGINS: set[str] = {
    "https://app.example.com",
    "https://admin.example.com",
    "https://api.example.com",
}

# CORS configuration
ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With"
EXPOSED_HEADERS = "Content-Type, X-Request-ID"
MAX_AGE = "600"  # seconds


def _is_trusted_origin(origin: str | None) -> bool:
    """Return True only if the origin is in the explicit whitelist."""
    if not origin:
        return False
    # Normalise: strip trailing slash to avoid trivial bypass
    normalised = origin.rstrip("/")
    return normalised in TRUSTED_ORIGINS


@app.before_request
def enforce_origin_on_cors_preflight() -> None:
    """
    For preflight (OPTIONS) requests, reject immediately if the origin is
    not trusted so we never expose CORS headers to unknown origins.
    """
    if request.method == "OPTIONS":
        origin = request.headers.get("Origin")
        if not _is_trusted_origin(origin):
            logger.warning(
                "Rejected preflight from untrusted origin: %r  path=%s",
                origin,
                request.path,
            )
            abort(403, description="Origin not allowed.")


@app.after_request
def apply_cors_headers(response):
    """
    Validate the Origin header on every response and apply fine-grained
    CORS headers.  Never sets Access-Control-Allow-Origin: * when
    credentials are involved.
    """
    origin = request.headers.get("Origin")

    # Always add Vary: Origin so that caches never serve a response
    # cached for one origin to a different origin.
    vary = response.headers.get("Vary")
    if vary:
        if "Origin" not in vary:
            response.headers["Vary"] = f"{vary}, Origin"
    else:
        response.headers["Vary"] = "Origin"

    if not origin:
        # Same-origin or non-browser request — no CORS headers needed.
        return response

    if not _is_trusted_origin(origin):
        logger.warning(
            "Blocked CORS response to untrusted origin: %r  method=%s  path=%s",
            origin,
            request.method,
            request.path,
        )
        # Do NOT add any Access-Control-* headers; the browser will block it.
        return response

    # Origin is trusted — reflect it explicitly (never a wildcard).
    response.headers["Access-Control-Allow-Origin"] = origin

    # Allow cookies / Authorization headers to be sent cross-origin.
    # This MUST NOT be combined with a wildcard origin.
    response.headers["Access-Control-Allow-Credentials"] = "true"

    # Expose selected headers to JavaScript running in the browser.
    response.headers["Access-Control-Expose-Headers"] = EXPOSED_HEADERS

    # Preflight-specific headers
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
        response.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
        response.headers["Access-Control-Max-Age"] = MAX_AGE
        # 204 No Content is the conventional response for a successful preflight.
        response.status_code = 204
        response.data = b""

    return response


# ---------------------------------------------------------------------------
# Example routes — replace with your real application routes
# ---------------------------------------------------------------------------

@app.route("/api/public", methods=["GET"])
def public_endpoint():
    return {"message": "This is a public endpoint."}, 200


@app.route("/api/secure", methods=["GET", "POST"])
def secure_endpoint():
    return {"message": "This endpoint requires a trusted origin."}, 200


@app.route("/api/data", methods=["GET", "PUT", "PATCH", "DELETE"])
def data_endpoint():
    return {"message": "Data endpoint — full CORS support for whitelisted origins."}, 200


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Use a production WSGI server (gunicorn, uvicorn, etc.) in production.
    app.run(host="127.0.0.1", port=5000, debug=False)