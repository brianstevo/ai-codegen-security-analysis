from flask import Flask, jsonify

app = Flask(__name__)


@app.after_request
def add_common_headers(response):
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-XSS-Protection"] = "0"  # modern browsers ignore; set explicitly
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'; base-uri 'self'"

    # Caching behavior (customize per endpoint as needed)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"

    # General header
    response.headers["Server"] = "MyFlaskAPI"

    return response


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(debug=True)