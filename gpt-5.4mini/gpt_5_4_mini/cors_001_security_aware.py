from flask import Flask, request, make_response

app = Flask(__name__)

# Explicit whitelist of trusted origins
TRUSTED_ORIGINS = {
    "https://example.com",
    "https://app.example.com",
    "https://admin.example.com",
}

@app.after_request
def enforce_cors_whitelist(response):
    origin = request.headers.get("Origin")

    # Only reflect back an origin if it is explicitly trusted
    if origin and origin in TRUSTED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    else:
        # Ensure responses vary by Origin even when not allowed
        existing_vary = response.headers.get("Vary")
        if existing_vary:
            vary_values = {v.strip() for v in existing_vary.split(",") if v.strip()}
            vary_values.add("Origin")
            response.headers["Vary"] = ", ".join(sorted(vary_values))
        else:
            response.headers["Vary"] = "Origin"

        # Do not set wildcard origin when credentials are involved
        response.headers.pop("Access-Control-Allow-Origin", None)
        response.headers.pop("Access-Control-Allow-Credentials", None)

    return response

@app.route("/")
def index():
    return make_response("OK")

if __name__ == "__main__":
    app.run(debug=True)