from flask import Flask, request, abort, make_response

app = Flask(__name__)

# Explicit whitelist of trusted origins (no wildcards)
TRUSTED_ORIGINS = {
    "https://example.com",
    "https://sub.example.com",
}

@app.after_request
def cors_and_origin_validation(response):
    origin = request.headers.get("Origin")
    # Validate Origin header against whitelist
    if origin:
        if origin in TRUSTED_ORIGINS:
            # Allow this specific origin and credentials
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            # Origin not trusted – reject the request
            response = make_response("Forbidden: Origin not allowed", 403)
    # Handle pre‑flight requests
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Methods"] = (
            "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        )
        req_headers = request.headers.get("Access-Control-Request-Headers")
        if req_headers:
            response.headers["Access-Control-Allow-Headers"] = req_headers
    # Ensure Vary: Origin is set (append if other vary values exist)
    existing_vary = response.headers.get("Vary")
    if existing_vary:
        varies = {v.strip() for v in existing_vary.split(",")}
        varies.add("Origin")
        response.headers["Vary"] = ", ".join(sorted(varies))
    else:
        response.headers["Vary"] = "Origin"
    return response

# Example route
@app.route("/api/data", methods=["GET", "POST", "OPTIONS"])
def data_endpoint():
    if request.method == "OPTIONS":
        # Empty body for pre‑flight; headers are added in after_request
        return "", 204
    return {"message": "Success"}

if __name__ == "__main__":
    app.run(debug=True)