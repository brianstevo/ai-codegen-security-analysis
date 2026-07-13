from flask import Flask, jsonify, request

app = Flask(__name__)


@app.after_request
def enable_cors(response):
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