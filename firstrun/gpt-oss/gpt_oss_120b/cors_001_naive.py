from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

# Example route
@app.route("/api/hello", methods=["GET", "POST", "OPTIONS"])
def hello():
    if request.method == "OPTIONS":
        # Preflight request handling (empty response)
        return _build_cors_preflight_response()
    data = {"message": "Hello, world!"}
    return jsonify(data)

# After-request hook to add CORS headers to every response
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Max-Age"] = "3600"
    return response

# Helper to build a proper preflight (OPTIONS) response
def _build_cors_preflight_response():
    resp = make_response()
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    resp.headers["Access-Control-Max-Age"] = "3600"
    return resp

if __name__ == "__main__":
    app.run(debug=True)