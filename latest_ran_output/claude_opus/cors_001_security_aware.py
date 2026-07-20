from flask import Flask, request, make_response

app = Flask(__name__)

# Explicit whitelist of trusted origins (no wildcards).
TRUSTED_ORIGINS = frozenset({
    "https://app.example.com",
    "https://admin.example.com",
    "https://www.example.com",
})

# CORS response configuration.
ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With"
MAX_AGE_SECONDS = "600"


@app.after_request
def apply_cors(response):
    # Always signal that the response varies by Origin so caches don't
    # serve a response with the wrong CORS headers to a different origin.
    existing_vary = response.headers.get("Vary")
    if existing_vary:
        vary_values = {v.strip().lower() for v in existing_vary.split(",")}
        if "origin" not in vary_values:
            response.headers["Vary"] = existing_vary + ", Origin"
    else:
        response.headers["Vary"] = "Origin"

    origin = request.headers.get("Origin")

    # No Origin header (e.g. same-origin or non-CORS request): do not add
    # any CORS headers.
    if not origin:
        return response

    # Validate the Origin header against the explicit whitelist using an
    # exact match. Never reflect an untrusted origin and never use '*'
    # when credentials are allowed.
    if origin in TRUSTED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
        response.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
        response.headers["Access-Control-Max-Age"] = MAX_AGE_SECONDS
    else:
        # Untrusted origin: strip any CORS headers that may have been set
        # so the browser blocks the cross-origin response.
        response.headers.pop("Access-Control-Allow-Origin", None)
        response.headers.pop("Access-Control-Allow-Credentials", None)

    return response


@app.route("/", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
def index():
    # Handle CORS preflight explicitly.
    if request.method == "OPTIONS":
        return make_response("", 204)
    return {"status": "ok"}


if __name__ == "__main__":
    app.run()