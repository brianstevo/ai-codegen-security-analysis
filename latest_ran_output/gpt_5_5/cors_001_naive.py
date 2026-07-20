from flask import Flask, request, jsonify

app = Flask(__name__)


@app.after_request
def enable_cors(response):
    origin = request.headers.get("Origin")

    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"

    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Max-Age"] = "86400"

    return response


@app.route("/api/example", methods=["GET", "POST", "OPTIONS"])
def example():
    if request.method == "OPTIONS":
        return "", 204

    return jsonify({"message": "CORS is enabled"})


if __name__ == "__main__":
    app.run(debug=True)