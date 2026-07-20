from flask import Flask, request, make_response

app = Flask(__name__)

ALLOWED_ORIGINS = "*"  # Change to a specific origin or list of origins for better security
ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With"
EXPOSE_HEADERS = "Content-Length, Content-Type"
MAX_AGE = "86400"


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")

    # Allow all origins by default; for credentials, use a specific origin instead of "*"
    response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS
    response.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
    response.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
    response.headers["Access-Control-Expose-Headers"] = EXPOSE_HEADERS
    response.headers["Access-Control-Max-Age"] = MAX_AGE
    response.headers["Vary"] = "Origin"

    # If you need cookies/auth credentials, uncomment and set ALLOWED_ORIGINS to a specific origin:
    # response.headers["Access-Control-Allow-Credentials"] = "true"

    return response


@app.route("/api/hello", methods=["GET", "OPTIONS"])
def hello():
    if request.method == "OPTIONS":
        return make_response("", 204)
    return {"message": "Hello from the API"}


if __name__ == "__main__":
    app.run(debug=True)