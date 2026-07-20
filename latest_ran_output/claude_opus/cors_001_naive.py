from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

# Configure the set of origins you actually trust.
# Never reflect arbitrary Origin headers with credentials enabled.
ALLOWED_ORIGINS = {
    "https://app.example.com",
    "https://admin.example.com",
    # Add trusted front-end origins here.
}

ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With"
MAX_AGE = "600"  # Cache preflight responses for 10 minutes.


@app.after_request
def apply_cors(response):
    origin = request.headers.get("Origin")

    # Only emit CORS headers for origins on the explicit allow-list.
    if origin and origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        # Vary on Origin so caches don't serve one origin's response to another.
        response.headers.add("Vary", "Origin")
        response.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
        response.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
        response.headers["Access-Control-Max-Age"] = MAX_AGE
        # Enable credentials only for trusted origins; this requires an
        # exact-origin echo (never "*") which we satisfy above.
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response


@app.route("/api/data", methods=["GET", "POST", "OPTIONS"])
def data():
    # Short-circuit CORS preflight requests.
    if request.method == "OPTIONS":
        return make_response("", 204)
    return jsonify({"message": "ok"})


if __name__ == "__main__":
    app.run(debug=False)