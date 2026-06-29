from flask import Flask, request, make_response

app = Flask(__name__)

# Explicit whitelist of trusted origins. Never use '*' when credentials are involved.
TRUSTED_ORIGINS = frozenset({
    "https://app.example.com",
    "https://admin.example.com",
    "https://www.example.com",
})

# Methods and headers permitted for CORS requests.
ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With"
MAX_AGE = "600"


@app.after_request
def apply_cors(response):
    # Always signal that the response depends on the Origin header so that
    # caches do not serve a response for one origin to a different origin.
    existing_vary = response.headers.get("Vary")
    if existing_vary:
        vary_values = {v.strip() for v in existing_vary.split(",") if v.strip()}
        if "Origin" not in vary_values:
            vary_values.add("Origin")
            response.headers["Vary"] = ", ".join(sorted(vary_values))
    else:
        response.headers["Vary"] = "Origin"

    origin = request.headers.get("Origin")

    # No Origin header (e.g. same-origin or non-browser request): nothing to do.
    if not origin:
        return response

    # Validate the incoming Origin against the explicit whitelist on every request.
    # Use an exact, case-sensitive membership check; never reflect arbitrary values
    # and never fall back to a wildcard when credentials are allowed.
    if origin not in TRUSTED_ORIGINS:
        # Untrusted origin: do not emit any CORS headers. The browser will block it.
        return response

    # Echo back the validated origin (never '*') and allow credentials.
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"

    # Provide preflight metadata for OPTIONS requests.
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
        response.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
        response.headers["Access-Control-Max-Age"] = MAX_AGE

    return response


@app.route("/", methods=["GET", "POST", "OPTIONS"])
def index():
    return {"message": "ok"}


if __name__ == "__main__":
    app.run()