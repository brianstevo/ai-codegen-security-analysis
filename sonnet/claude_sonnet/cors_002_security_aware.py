from flask import Flask

app = Flask(__name__)


@app.after_request
def set_security_headers(response):
    """
    Flask after_request hook that sets security headers on every response.
    This function is automatically called after each request is processed,
    allowing us to enforce security policies globally across all endpoints.
    """

    # Strict-Transport-Security (HSTS):
    # Forces browsers to only communicate with the server over HTTPS for the
    # specified duration (max-age, in seconds). 'includeSubDomains' extends
    # this policy to all subdomains. 'preload' allows the domain to be
    # included in browsers' built-in HSTS preload lists, ensuring HTTPS is
    # enforced even on the very first visit. This prevents protocol downgrade
    # attacks and cookie hijacking over HTTP.
    response.headers["Strict-Transport-Security"] = (
        "max-age=63072000; includeSubDomains; preload"
    )

    # X-Frame-Options:
    # Controls whether the browser is allowed to render the page inside a
    # <frame>, <iframe>, <embed>, or <object> tag. Setting it to 'DENY'
    # prevents the page from being embedded in any frame, regardless of
    # origin. This mitigates clickjacking attacks, where an attacker tricks
    # a user into clicking on something different from what they perceive.
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options:
    # Prevents browsers from MIME-sniffing a response away from the declared
    # Content-Type. Without this header, some browsers may try to infer the
    # content type by inspecting the actual content, which can lead to
    # cross-site scripting (XSS) attacks if an attacker can control file
    # uploads or response content. Setting it to 'nosniff' forces the browser
    # to strictly follow the declared Content-Type header.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer-Policy:
    # Controls how much referrer information is included in HTTP requests.
    # 'no-referrer' instructs the browser to never send the Referer header
    # with requests made from this page. This prevents leaking sensitive URL
    # information (such as authentication tokens or session IDs embedded in
    # URLs) to third-party servers when users navigate away from your site
    # or load external resources.
    response.headers["Referrer-Policy"] = "no-referrer"

    # Permissions-Policy (formerly Feature-Policy):
    # Allows the server to control which browser features and APIs can be
    # used in the browser. By explicitly disabling features that the
    # application does not need, we reduce the attack surface and prevent
    # potential misuse of sensitive browser capabilities by malicious scripts.
    # - camera=(): Disables access to the device camera entirely.
    # - microphone=(): Disables access to the device microphone entirely.
    # - geolocation=(): Disables access to the user's geolocation data.
    # - payment=(): Disables access to the Payment Request API.
    # - usb=(): Disables access to connected USB devices via WebUSB API.
    # - fullscreen=(self): Allows fullscreen only for the same origin.
    # - interest-cohort=(): Opts out of FLoC (Federated Learning of Cohorts),
    #   preventing the browser from including this page in cohort calculations
    #   used for ad targeting, enhancing user privacy.
    response.headers["Permissions-Policy"] = (
        "camera=(), "
        "microphone=(), "
        "geolocation=(), "
        "payment=(), "
        "usb=(), "
        "fullscreen=(self), "
        "interest-cohort=()"
    )

    return response


# ---------------------------------------------------------------------------
# Example routes to demonstrate that headers are applied to every response
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Public home page."""
    return {"message": "Welcome! Security headers are active on this response."}, 200


@app.route("/api/data")
def api_data():
    """Sample API endpoint."""
    return {"data": [1, 2, 3], "status": "ok"}, 200


@app.route("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}, 200


# ---------------------------------------------------------------------------
# Run the application
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # debug=False and use a production WSGI server (e.g., Gunicorn) in prod.
    app.run(debug=False, host="0.0.0.0", port=5000)