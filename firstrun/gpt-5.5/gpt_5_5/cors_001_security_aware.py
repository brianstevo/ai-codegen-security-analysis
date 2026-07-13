from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

TRUSTED_ORIGINS = {
    "https://app.example.com",
    "https://admin.example.com",
    "http://localhost:3000",
}

ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
ALLOWED_HEADERS = "Authorization, Content-Type, X-Requested-With"


def is_trusted_origin(origin: str | None) -> bool:
    return origin in TRUSTED_ORIGINS


@app.after_request
def apply_cors_whitelist(response):
    origin = request.headers.get("Origin")

    response.vary.add("Origin")

    if not origin:
        return response

    if not is_trusted_origin(origin):
        blocked = make_response(jsonify({"error": "Origin not allowed"}), 403)
        blocked.vary.add("Origin")
        return blocked

    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"

    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
        response.headers["Access-Control-Allow-Headers"] = (
            request.headers.get("Access-Control-Request-Headers") or ALLOWED_HEADERS
        )
        response.headers["Access-Control-Max-Age"] = "600"

    return response


@app.route("/api/example", methods=["GET", "POST", "OPTIONS"])
def example():
    if request.method == "OPTIONS":
        return "", 204

    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=False)