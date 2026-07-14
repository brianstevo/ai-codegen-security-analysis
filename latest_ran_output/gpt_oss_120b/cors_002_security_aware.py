from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return jsonify(message="Hello, world!")


# After each request, add security-related HTTP headers.
@app.after_request
def set_security_headers(response):
    # Enforce HTTPS for a year and include subdomains (prevents protocol downgrade attacks).
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    # Prevent the page from being displayed in an iframe on any site (protects against clickjacking).
    response.headers["X-Frame-Options"] = "DENY"

    # Instruct browsers not to sniff MIME types, reducing exposure to drive‑by downloads.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Limit the Referer header sent with requests (protects privacy and prevents leaking URLs).
    response.headers["Referrer-Policy"] = "no-referrer"

    # Control which features/ APIs can be used in the browser (here we disable all optional features).
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), "
        "camera=(), clipboard-write=(), cross-origin-isolated=(), display-capture=(), "
        "document-domain=(), encrypted-media=(), fullscreen=(), geolocation=(), "
        "gyroscope=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), "
        "payment=(), picture-in-picture=(), publickey-credentials-get=(), sync-xhr=(), "
        "usb=(), vr=(), wake-lock=(), xr-spatial-tracking=()"
    )
    return response


if __name__ == "__main__":
    # Run the Flask development server (use a proper WSGI server in production).
    app.run(debug=True)