from flask import Flask

app = Flask(__name__)


@app.after_request
def add_security_headers(response):
    """
    Add common HTTP security and cache headers to every response.
    """

    # ── Content Security Policy ───────────────────────────────────────────────
    # Restricts sources of content to mitigate XSS and data-injection attacks.
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )

    # ── Strict-Transport-Security ─────────────────────────────────────────────
    # Forces browsers to use HTTPS for 1 year, including all subdomains.
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )

    # ── X-Content-Type-Options ────────────────────────────────────────────────
    # Prevents browsers from MIME-sniffing a response away from the declared
    # Content-Type.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # ── X-Frame-Options ───────────────────────────────────────────────────────
    # Prevents the page from being loaded in an <iframe> (clickjacking defence).
    response.headers["X-Frame-Options"] = "DENY"

    # ── X-XSS-Protection ─────────────────────────────────────────────────────
    # Enables the Cross-site Scripting (XSS) filter built into older browsers.
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # ── Referrer-Policy ───────────────────────────────────────────────────────
    # Controls how much referrer information is included with requests.
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # ── Permissions-Policy ────────────────────────────────────────────────────
    # Restricts access to browser APIs / features.
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), "
        "camera=(), "
        "geolocation=(), "
        "gyroscope=(), "
        "magnetometer=(), "
        "microphone=(), "
        "payment=(), "
        "usb=()"
    )

    # ── Cache-Control ─────────────────────────────────────────────────────────
    # Prevents sensitive responses from being cached by the browser or proxies.
    # Override this header on routes that serve static / public assets.
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"  # HTTP/1.0 back-compat
    response.headers["Expires"] = "0"

    # ── Cross-Origin headers ──────────────────────────────────────────────────
    # COEP / COOP / CORP improve isolation and are required for SharedArrayBuffer.
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

    # ── Remove server banner ──────────────────────────────────────────────────
    # Avoids leaking implementation details to potential attackers.
    response.headers.pop("Server", None)
    response.headers.pop("X-Powered-By", None)

    return response


# ── Example routes ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return {"message": "Hello, World!"}, 200


@app.route("/public-asset")
def public_asset():
    """
    Example route that overrides Cache-Control for a publicly cacheable resource.
    """
    response = app.make_response({"data": "public"})
    # Override the default no-store set by the after_request hook.
    response.headers["Cache-Control"] = "public, max-age=86400, immutable"
    response.headers.pop("Pragma", None)
    response.headers.pop("Expires", None)
    return response


@app.route("/error-demo")
def error_demo():
    """
    Security headers are also added to error responses because the
    after_request hook runs for every response, including error handlers.
    """
    return {"error": "Something went wrong"}, 500


if __name__ == "__main__":
    # Never enable debug=True in production.
    app.run(debug=False, host="127.0.0.1", port=5000)