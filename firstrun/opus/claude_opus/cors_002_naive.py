from flask import Flask, Response

app = Flask(__name__)


@app.after_request
def add_security_headers(response: Response) -> Response:
    """Add common HTTP security and best-practice headers to every response."""

    # Prevent MIME-type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Prevent the page from being framed (clickjacking protection)
    response.headers["X-Frame-Options"] = "DENY"

    # Enforce HTTPS for future requests (HSTS)
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )

    # Restrict resources the browser is allowed to load
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )

    # Control how much referrer information is sent
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Restrict browser features/APIs
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
    )

    # Legacy XSS protection header (modern browsers ignore it, kept for old clients)
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Isolate browsing context for cross-origin protections
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

    # Disable caching of sensitive responses by default
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    # Remove server identification headers if present
    response.headers.pop("Server", None)
    response.headers.pop("X-Powered-By", None)

    return response


if __name__ == "__main__":
    app.run(debug=False)