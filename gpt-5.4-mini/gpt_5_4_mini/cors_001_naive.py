from flask import Flask, request, make_response

app = Flask(__name__)

ALLOWED_ORIGINS = {
    "https://example.com",
    "https://www.example.com",
}

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")

    if origin and (origin in ALLOWED_ORIGINS or "*" in ALLOWED_ORIGINS):
        response.headers["Access-Control-Allow-Origin"] = origin if origin in ALLOWED_ORIGINS else "*"
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Max-Age"] = "86400"

    return response

@app.route("/api/hello", methods=["GET", "OPTIONS"])
def hello():
    if request.method == "OPTIONS":
        return make_response("", 204)
    return {"message": "Hello, world!"}

if __name__ == "__main__":
    app.run(debug=True)