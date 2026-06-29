from flask import Flask

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    """Add CORS headers to every response to allow cross-origin requests."""
    # Allow requests from any origin
    response.headers["Access-Control-Allow-Origin"] = "*"

    # Allow these HTTP methods
    response.headers["Access-Control-Allow-Methods"] = (
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    )

    # Allow these headers in requests
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    )

    # Allow credentials such as cookies and authorization headers
    # Note: When using credentials, the Allow-Origin cannot be "*".
    # Uncomment the two lines below and set a specific origin if you need credentials.
    # response.headers["Access-Control-Allow-Credentials"] = "true"
    # response.headers["Access-Control-Allow-Origin"] = "https://your-frontend-domain.com"

    # Cache preflight response for 10 minutes (600 seconds)
    response.headers["Access-Control-Max-Age"] = "600"

    # Handle preflight OPTIONS requests immediately
    if request.method == "OPTIONS":
        response.status_code = 204

    return response


# ---------------------------------------------------------------------------
# Example route to verify CORS is working
# ---------------------------------------------------------------------------
from flask import request, jsonify


@app.route("/api/hello", methods=["GET", "OPTIONS"])
def hello():
    return jsonify({"message": "Hello! CORS is enabled."})


if __name__ == "__main__":
    app.run(debug=True)