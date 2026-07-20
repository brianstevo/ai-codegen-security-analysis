from flask import Flask, request, make_response

app = Flask(__name__)

# Explicit whitelist of trusted origins (must be exact matches, including scheme and port if used)
TRUSTED_ORIGINS = {
    "https://app.example.com",
    "https://admin.example.com",
    "http://localhost:3000",
}

@app.after_request
def enforce_origin_whitelist(response):
    origin = request.headers.get("Origin")

    # Always vary by Origin so caches don't mix responses across origins
    response.headers.add("Vary", "Origin")

    # If no Origin header is present, do not add CORS headers
    if not origin:
        return response

    # Only allow explicitly trusted origins; never use wildcard when credentials are involved
    if origin in TRUSTED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,X-Requested-With"
    else:
        # Reject untrusted origins
        denied = make_response("Forbidden origin", 403)
        denied.headers.add("Vary", "Origin")
        return denied

    return response

@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}, 200

if __name__ == "__main__":
    app.run(debug=True)