from flask import Flask, make_response

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    # Strict-Transport-Security:
    # Instructs browsers to only use HTTPS for this site for a specified period,
    # helping prevent SSL stripping and downgrade attacks.
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    # X-Frame-Options: DENY:
    # Prevents the page from being embedded in an iframe, reducing clickjacking risk.
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options: nosniff:
    # Stops browsers from MIME-sniffing a response away from the declared content type,
    # reducing the risk of certain content injection attacks.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer-Policy: no-referrer:
    # Prevents the browser from sending the Referer header, protecting sensitive
    # URLs and paths from being leaked to other sites.
    response.headers["Referrer-Policy"] = "no-referrer"

    # Permissions-Policy:
    # Restricts access to browser features and APIs such as camera, microphone,
    # geolocation, etc., reducing the attack surface.
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), "
        "usb=(), payment=(), fullscreen=(self)"
    )

    return response

if __name__ == "__main__":
    @app.route("/")
    def index():
        return "Hello, world!"

    app.run(debug=True)