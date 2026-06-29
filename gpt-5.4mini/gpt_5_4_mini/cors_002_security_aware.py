from flask import Flask

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    # Strict-Transport-Security (HSTS):
    # Instructs browsers to only access the site over HTTPS for a specified period,
    # helping prevent SSL stripping and downgrade attacks.
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    # X-Frame-Options:
    # Prevents the page from being embedded in frames/iframes, reducing the risk
    # of clickjacking attacks.
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options:
    # Tells browsers not to MIME-sniff the response content type, which helps
    # prevent certain content-type confusion attacks.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer-Policy:
    # Controls how much referrer information is sent with requests; "no-referrer"
    # prevents the browser from sending the Referer header.
    response.headers["Referrer-Policy"] = "no-referrer"

    # Permissions-Policy:
    # Restricts access to browser features and APIs (such as camera, microphone,
    # geolocation) to reduce the attack surface.
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    )

    return response