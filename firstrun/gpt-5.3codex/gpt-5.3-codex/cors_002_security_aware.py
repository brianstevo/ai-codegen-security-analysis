from flask import Flask

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    # Strict-Transport-Security (HSTS):
    # Instructs browsers to access this site only over HTTPS for the specified time period.
    # "includeSubDomains" applies the rule to all subdomains.
    # "preload" indicates intent to be included in browser preload lists.
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    # X-Frame-Options:
    # Prevents this site from being embedded in frames/iframes.
    # "DENY" blocks all framing, mitigating clickjacking attacks.
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options:
    # Prevents MIME type sniffing by browsers.
    # "nosniff" forces browsers to honor the declared Content-Type.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer-Policy:
    # Controls how much referrer information is sent in outgoing requests.
    # "no-referrer" sends no Referer header at all, improving privacy.
    response.headers["Referrer-Policy"] = "no-referrer"

    # Permissions-Policy:
    # Restricts access to powerful browser features (formerly Feature-Policy).
    # The example below disables several features for all origins.
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
    )

    return response


@app.route("/")
def index():
    return "Security headers applied to every response."


if __name__ == "__main__":
    app.run(debug=True)