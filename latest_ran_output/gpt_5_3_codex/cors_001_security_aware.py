from flask import Flask, request, abort

app = Flask(__name__)

# Explicit whitelist of trusted origins (exact match, including scheme + host [+ port])
TRUSTED_ORIGINS = {
    "https://app.example.com",
    "https://admin.example.com",
    "http://localhost:3000",
}


@app.before_request
def enforce_origin_whitelist():
    """
    Validate Origin on each request.
    - For browser CORS requests, Origin is expected and must be whitelisted.
    - For non-browser clients where Origin may be absent, allow by default.
      (If you want to require Origin for all requests, remove this conditional.)
    """
    origin = request.headers.get("Origin")
    if origin is not None and origin not in TRUSTED_ORIGINS:
        abort(403, description="Origin not allowed")


@app.after_request
def apply_cors_headers(response):
    """
    Reflect allowed origin only (never '*') and set Vary: Origin.
    """
    origin = request.headers.get("Origin")

    # Ensure caches vary by Origin
    response.headers.add("Vary", "Origin")

    if origin and origin in TRUSTED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        # Optional CORS headers for preflight/typed requests:
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        requested_headers = request.headers.get("Access-Control-Request-Headers")
        response.headers["Access-Control-Allow-Headers"] = (
            requested_headers if requested_headers else "Content-Type, Authorization"
        )

    return response


@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}, 200


if __name__ == "__main__":
    app.run(debug=True)