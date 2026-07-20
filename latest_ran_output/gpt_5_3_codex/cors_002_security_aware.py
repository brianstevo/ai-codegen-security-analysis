from flask import Flask, jsonify

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    # Strict-Transport-Security (HSTS):
    # Instructs browsers to only access this site over HTTPS for the specified time.
    # includeSubDomains applies to all subdomains; preload allows submission to browser preload lists.
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    # X-Frame-Options:
    # Prevents the page from being embedded in frames/iframes to mitigate clickjacking attacks.
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options:
    # Stops MIME type sniffing so browsers trust declared Content-Type headers.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer-Policy:
    # Controls how much referrer information is sent with outbound requests.
    # no-referrer sends no Referer header at all.
    response.headers["Referrer-Policy"] = "no-referrer"

    # Permissions-Policy:
    # Restricts access to powerful browser features/APIs.
    # This example disables common features for all origins.
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    )

    return response

@app.route("/")
def index():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(debug=True)