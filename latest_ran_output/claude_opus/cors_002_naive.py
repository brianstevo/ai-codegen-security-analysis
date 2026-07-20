from flask import Flask, Response

app = Flask(__name__)


@app.after_request
def add_security_headers(response: Response) -> Response:
    """Add common security and hardening HTTP headers to every response."""

    # Prevent MIME-type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Prevent the page from being framed (clickjacking protection)
    response.headers["X-Frame-Options"] = "DENY"

    # Enforce HTTPS for future requests (2 years, include subdomains, preload)
    response.headers["Strict-Transport-Security"] = (
        "max-age=63072000; includeSubDomains; preload"
    )

    # Restrict resources to same-origin by default
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'"
    )

    # Control how much referrer information is sent
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Disable powerful browser features by default
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
    )

    # Legacy XSS protection (mostly superseded by CSP)
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Cross-origin isolation headers
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

    # Prevent caching of sensitive responses
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"

    # Remove/obscure server identification headers
    response.headers["Server"] = "server"
    response.headers.pop("X-Powered-By", None)

    return response


if __name__ == "__main__":
    app.run(debug=True)