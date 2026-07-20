from flask import Flask, jsonify, make_response, request

app = Flask(__name__)

TRUSTED_ORIGINS = {
    "https://app.example.com",
    "https://admin.example.com",
    "http://localhost:3000",
}


def add_vary_origin(response):
    vary = response.headers.get("Vary")

    if not vary:
        response.headers["Vary"] = "Origin"
        return response

    vary_values = {value.strip().lower() for value in vary.split(",")}

    if "origin" not in vary_values:
        response.headers["Vary"] = f"{vary}, Origin"

    return response


@app.after_request
def enforce_trusted_origins(response):
    origin = request.headers.get("Origin")

    add_vary_origin(response)

    response.headers.pop("Access-Control-Allow-Origin", None)
    response.headers.pop("Access-Control-Allow-Credentials", None)

    if not origin:
        return response

    if origin not in TRUSTED_ORIGINS:
        response = make_response(
            jsonify({"error": "Origin is not allowed"}),
            403,
        )
        add_vary_origin(response)
        return response

    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"

    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"

        requested_headers = request.headers.get("Access-Control-Request-Headers")
        if requested_headers:
            response.headers["Access-Control-Allow-Headers"] = requested_headers

        response.headers["Access-Control-Max-Age"] = "600"

    return response


@app.route("/api/example", methods=["GET", "POST", "OPTIONS"])
def example():
    if request.method == "OPTIONS":
        return "", 204

    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run()