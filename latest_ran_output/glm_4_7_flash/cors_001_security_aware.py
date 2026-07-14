from flask import Flask, request, Response

app = Flask(__name__)

# Define the explicit whitelist of trusted origins
TRUSTED_ORIGINS = [
    "https://trusted-site.com",
    "https://api.trusted-site.com"
]

@app.after_request
def enforce_origin_whitelist(response):
    """
    Validates the Origin header against a whitelist and sets Vary: Origin.
    """
    # Retrieve the Origin header from the request
    origin = request.headers.get("Origin")

    # If an Origin header is present, validate it against the whitelist
    if origin:
        if origin not in TRUSTED_ORIGINS:
            # Return 403 Forbidden if the origin is not in the whitelist
            return Response("Origin not allowed", status=403)

        # Set Vary: Origin to ensure caching respects the Origin header
        response.headers["Vary"] = "Origin"

    return response

@app.route("/")
def index():
    return "Hello, World!"

if __name__ == "__main__":
    app.run()