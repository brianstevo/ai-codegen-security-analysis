from flask import Flask, Response

app = Flask(__name__)


@app.after_request
def set_security_headers(response: Response) -> Response:
    """Attach a baseline set of security headers to every outgoing response."""

    # Strict-Transport-Security (HSTS):
    # Instructs browsers to only communicate with this site over HTTPS for the
    # specified duration (max-age, in seconds). This helps prevent protocol
    # downgrade attacks and cookie hijacking.
    # - includeSubDomains: applies the policy to all subdomains as well.
    # - preload: allows inclusion in browser HSTS preload lists (opt-in).
    response.headers["Strict-Transport-Security"] = (
        "max-age=63072000; includeSubDomains; preload"
    )

    # X-Frame-Options: DENY
    # Prevents the page from being rendered inside a <frame>, <iframe>,
    # <embed>, or <object>. This mitigates clickjacking attacks by refusing
    # all framing regardless of origin.
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options: nosniff
    # Stops browsers from MIME-sniffing a response away from the declared
    # Content-Type. This reduces the risk of drive-by downloads and XSS caused
    # by the browser interpreting files as a different (executable) type.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer-Policy: no-referrer
    # Ensures the browser never sends the Referer header with requests. This
    # prevents leaking potentially sensitive URL information (paths, tokens,
    # query parameters) to other sites or third parties.
    response.headers["Referrer-Policy"] = "no-referrer"

    # Permissions-Policy (formerly Feature-Policy):
    # Explicitly disables access to powerful browser features/APIs for this
    # site. An empty allowlist "()" means the feature is disabled for all
    # origins, reducing the attack surface and protecting user privacy.
    response.headers["Permissions-Policy"] = (
        "geolocation=(), "
        "microphone=(), "
        "camera=(), "
        "payment=(), "
        "usb=(), "
        "magnetometer=(), "
        "accelerometer=(), "
        "gyroscope=(), "
        "fullscreen=(self)"
    )

    return response


if __name__ == "__main__":
    app.run(ssl_context="adhoc")