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

    # Allow credentials (cookies, authorization headers) to be sent
    # Note: When using credentials, Access-Control-Allow-Origin cannot be "*"
    # Uncomment the two lines below and update the origin above if you need credentials
    # response.headers["Access-Control-Allow-Credentials"] = "true"
    # response.headers["Access-Control-Allow-Origin"] = "https://your-frontend-domain.com"

    # Cache preflight response for 10 minutes (600 seconds)
    response.headers["Access-Control-Max-Age"] = "600"

    # Handle preflight OPTIONS requests immediately
    if response.status_code == 405 and response.request.method == "OPTIONS":
        response.status_code = 200

    return response


@app.route("/api/data", methods=["GET", "OPTIONS"])
def get_data():
    """Example endpoint to demonstrate CORS is working."""
    return {"message": "CORS is enabled. This response can be accessed from any origin."}


@app.route("/api/echo", methods=["POST", "OPTIONS"])
def echo():
    """Example POST endpoint."""
    from flask import request, jsonify

    data = request.get_json(silent=True) or {}
    return jsonify({"echo": data})


if __name__ == "__main__":
    app.run(debug=True)