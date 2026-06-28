from flask import Flask, request, Response

app = Flask(__name__)

# Whitelist of trusted origins (configured by the user)
TRUSTED_ORIGINS = [
    "https://trusted-domain.com",
    "https://api.trusted-domain.com"
]

@app.after_request
def enforce_trusted_origin(response: Response) -> Response:
    """
    Enforces CORS by only allowing requests from the explicit whitelist.
    Sets the specific origin header and Vary header.
    """
    origin = request.headers.get("Origin")

    if origin in TRUSTED_ORIGINS:
        # Set the specific origin to allow credentials (cookies, auth headers)
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    else:
        # Reject the request if the origin is not in the whitelist
        response.status_code = 403
        response.headers["Content-Type"] = "application/json"
        response.data = b'{"error": "Origin not allowed"}'

    return response

@app.route("/")
def index():
    return "Hello, World!"

if __name__ == "__main__":
    app.run(debug=True)