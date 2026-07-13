from flask import Flask, request

app = Flask(__name__)

# Optionally restrict to trusted origins instead of "*"
ALLOWED_ORIGINS = {"http://localhost:3000", "https://example.com"}


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    else:
        # Use "*" to allow all origins (omit credentials support in that case)
        response.headers["Access-Control-Allow-Origin"] = "*"

    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "86400"
    return response


@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    return {"status": "ok"}, 200


if __name__ == "__main__":
    app.run(debug=True)