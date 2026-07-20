from flask import Flask

app = Flask(__name__)


@app.after_request
def add_security_headers(response):
    """
    Adds common HTTP security and cache headers to every response.
    """
    # ------------------------------------------------------------------ #
    # Security Headers
    # ------------------------------------------------------------------ #

    # Prevent browsers from MIME-sniffing the content type
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Enable the browser's built-in XSS filter (legacy; still useful for older browsers)
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Disallow the page from being embedded in an iframe (clickjacking protection)
    response.headers["X-Frame-Options"] = "DENY"

    # Enforce HTTPS for 1 year, including sub-domains, and allow preload
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )

    # Content Security Policy – restrict resource origins
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )

    # Control how much referrer information is included with requests
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Restrict browser features / APIs
    response.headers["Permissions-Policy"] = (
        "geolocation=(), "
        "microphone=(), "
        "camera=(), "
        "payment=(), "
        "usb=(), "
        "magnetometer=(), "
        "gyroscope=(), "
        "accelerometer=()"
    )

    # Opt out of FLoC / Topics API tracking
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

    # ------------------------------------------------------------------ #
    # Cache-Control Headers
    # ------------------------------------------------------------------ #

    # Only set default cache headers if the route hasn't already set them
    if "Cache-Control" not in response.headers:
        if response.status_code in (200, 203, 206):
            # Cache successful responses for 5 minutes; must revalidate after
            response.headers["Cache-Control"] = "public, max-age=300, must-revalidate"
        elif response.status_code in (301,):
            # Cache permanent redirects for 1 hour
            response.headers["Cache-Control"] = "public, max-age=3600"
        else:
            # Do not cache error responses, redirects, or anything else
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

    # ------------------------------------------------------------------ #
    # CORS Headers  (adjust origins / methods as needed for your app)
    # ------------------------------------------------------------------ #

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = (
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    )
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, Authorization, X-Requested-With"
    )
    response.headers["Access-Control-Max-Age"] = "600"

    # ------------------------------------------------------------------ #
    # Miscellaneous Headers
    # ------------------------------------------------------------------ #

    # Remove the 'Server' header to avoid leaking server technology details
    response.headers.pop("Server", None)

    # Add a custom application identifier (optional)
    response.headers["X-Application"] = "MyFlaskApp/1.0"

    return response


# ------------------------------------------------------------------ #
# Example routes for manual testing
# ------------------------------------------------------------------ #

@app.route("/")
def index():
    return {"message": "Hello, World!"}, 200


@app.route("/error")
def error():
    return {"error": "Something went wrong"}, 500


@app.route("/redirect-example")
def redirect_example():
    from flask import redirect, url_for
    return redirect(url_for("index"), code=301)


if __name__ == "__main__":
    # Debug=False in production; use a proper WSGI server (gunicorn, uWSGI, etc.)
    app.run(debug=True, host="0.0.0.0", port=5000)