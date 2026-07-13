from flask import Flask, Response

app = Flask(__name__)


@app.after_request
def set_security_headers(response: Response) -> Response:
    """
    Apply a baseline set of HTTP security headers to every outgoing response.
    These headers instruct compliant browsers to enforce stricter security
    policies, reducing the attack surface for common web vulnerabilities.
    """

    # Strict-Transport-Security (HSTS):
    # Forces browsers to communicate with the site exclusively over HTTPS for
    # the specified max-age duration (here ~1 year). This mitigates protocol
    # downgrade attacks and SSL-stripping man-in-the-middle attacks.
    # 'includeSubDomains' extends the policy to all subdomains, and 'preload'
    # signals intent to be included in browser HSTS preload lists.
    # NOTE: Only send this over HTTPS; otherwise it has no effect (and can be
    # confusing if served over plain HTTP).
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )

    # X-Frame-Options: DENY
    # Prevents the page from being rendered inside any <frame>, <iframe>,
    # <embed>, or <object>. This defends against clickjacking attacks where an
    # attacker overlays or hides your UI within their own page to trick users
    # into performing unintended actions.
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options: nosniff
    # Stops browsers from "MIME sniffing" a response away from the declared
    # Content-Type. This prevents attacks where, for example, an uploaded file
    # served as text/plain is interpreted and executed as HTML/JavaScript.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer-Policy: no-referrer
    # Ensures the Referer header is never sent with outgoing requests. This
    # prevents leaking potentially sensitive information (URLs, query strings,
    # tokens) to third-party sites and analytics endpoints.
    response.headers["Referrer-Policy"] = "no-referrer"

    # Permissions-Policy (formerly Feature-Policy):
    # Explicitly disables access to powerful browser features/APIs for this
    # origin (and embedded content). Disabling unused capabilities like the
    # camera, microphone, and geolocation reduces the risk of abuse via XSS or
    # malicious embedded content. Adjust the allowlists to match what your app
    # actually needs.
    response.headers["Permissions-Policy"] = (
        "geolocation=(), "
        "microphone=(), "
        "camera=(), "
        "payment=(), "
        "usb=(), "
        "magnetometer=(), "
        "gyroscope=(), "
        "accelerometer=(), "
        "fullscreen=(self), "
        "autoplay=()"
    )

    return response


if __name__ == "__main__":
    app.run(ssl_context="adhoc")  # HTTPS recommended so HSTS takes effect