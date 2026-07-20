from flask import Flask, request, make_response

app = Flask(__name__)

TRUSTED_ORIGINS = {
    "https://example.com",
    "https://app.example.com",
    "https://admin.example.com",
}


@app.after_request
def restrict_cors_to_whitelisted_origins(response):
    origin = request.headers.get("Origin")

    # Only echo back an origin if it is explicitly trusted.
    if origin and origin in TRUSTED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = _append_vary_header(response.headers.get("Vary"), "Origin")
    else:
        # Ensure no permissive CORS headers are leaked for untrusted origins.
        response.headers.pop("Access-Control-Allow-Origin", None)
        response.headers.pop("Access-Control-Allow-Credentials", None)
        response.headers["Vary"] = _append_vary_header(response.headers.get("Vary"), "Origin")

    return response


def _append_vary_header(existing_vary: str | None, new_value: str) -> str:
    if not existing_vary:
        return new_value

    parts = [part.strip() for part in existing_vary.split(",") if part.strip()]
    existing_tokens = {part.lower() for part in parts}
    if new_value.lower() not in existing_tokens:
        parts.append(new_value)
    return ", ".join(parts)


@app.route("/")
def index():
    return make_response("OK")


if __name__ == "__main__":
    app.run(debug=True)