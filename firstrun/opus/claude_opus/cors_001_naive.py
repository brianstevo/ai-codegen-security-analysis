from flask import Flask, request, make_response

app = Flask(__name__)

# Configure the set of origins you actually trust. Avoid using a wildcard "*"
# combined with credentials, and never blindly reflect the incoming Origin.
ALLOWED_ORIGINS = {
    "https://app.example.com",
    "https://admin.example.com",
}

ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With"
MAX_AGE = "600"  # seconds the preflight result may be cached


@app.after_request
def apply_cors(response):
    origin = request.headers.get("Origin")

    # Only emit CORS headers when the request comes from a known-good origin.
    if origin and origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        # Allow cookies/Authorization to be sent cross-origin.
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
        response.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
        response.headers["Access-Control-Max-Age"] = MAX_AGE

        # Because the allowed origin depends on the request's Origin header,
        # tell caches to vary on it (prevents poisoning across origins).
        existing_vary = response.headers.get("Vary")
        if existing_vary:
            if "Origin" not in [v.strip() for v in existing_vary.split(",")]:
                response.headers["Vary"] = existing_vary + ", Origin"
        else:
            response.headers["Vary"] = "Origin"

    return response


@app.route("/api/<path:_any>", methods=["OPTIONS"])
def cors_preflight(_any):
    # Respond to preflight requests; the after_request hook adds the headers.
    return make_response("", 204)


@app.route("/api/ping", methods=["GET"])
def ping():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(debug=False)