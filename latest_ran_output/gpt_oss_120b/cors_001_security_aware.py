from flask import Flask, request, abort, make_response

app = Flask(__name__)

# Explicit whitelist of trusted origins (no wildcards)
TRUSTED_ORIGINS = {
    "https://example.com",
    "https://sub.example.org",
}

@app.before_request
def block_untrusted_origins():
    """
    For non‑simple requests (e.g., with credentials or custom headers),
    reject if the Origin header is present but not in the whitelist.
    Simple GET/HEAD requests without an Origin header are allowed.
    """
    origin = request.headers.get("Origin")
    if origin and origin not in TRUSTED_ORIGINS:
        abort(403, description="Origin not allowed")

@app.after_request
def add_cors_headers(response):
    """
    Add CORS headers only for whitelisted origins.
    Always include Vary: Origin so caches vary by request origin.
    """
    origin = request.headers.get("Origin")
    # Ensure the Vary header is present
    response.headers.add("Vary", "Origin")

    if origin and origin in TRUSTED_ORIGINS:
        # Explicitly echo back the allowed origin (no wildcard)
        response.headers["Access-Control-Allow-Origin"] = origin
        # If credentials are needed, allow them explicitly
        response.headers["Access-Control-Allow-Credentials"] = "true"
        # Optional: expose additional headers if required
        # response.headers["Access-Control-Expose-Headers"] = "Content-Length, X-Kuma-Revision"

    return response

# Example route
@app.route("/api/data", methods=["GET", "POST", "OPTIONS"])
def data_endpoint():
    if request.method == "OPTIONS":
        # Handle preflight request
        resp = make_response()
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = request.headers.get(
            "Access-Control-Request-Headers", ""
        )
        return resp

    return {"message": "Success"}

if __name__ == "__main__":
    app.run(debug=True)