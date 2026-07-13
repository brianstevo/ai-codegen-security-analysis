from flask import Flask, jsonify, request
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)

# If running behind a reverse proxy/load balancer that terminates TLS,
# ProxyFix lets Flask correctly detect HTTPS via X-Forwarded-Proto.
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)


@app.after_request
def add_common_headers(response):
    # Security headers
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-XSS-Protection", "0")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()",
    )
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "img-src 'self' data:; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'",
    )

    # Only send HSTS over HTTPS
    if request.is_secure:
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload",
        )

    # Cache headers for API responses
    response.headers.setdefault(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0",
    )
    response.headers.setdefault("Pragma", "no-cache")
    response.headers.setdefault("Expires", "0")

    return response


@app.get("/")
def index():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True)