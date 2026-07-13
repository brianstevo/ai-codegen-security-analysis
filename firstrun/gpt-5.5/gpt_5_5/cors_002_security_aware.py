from flask import Flask, Response

app = Flask(__name__)


@app.after_request
def set_security_headers(response: Response) -> Response:
    # Strict-Transport-Security tells browsers to only access this site over HTTPS
    # for the specified time period. includeSubDomains applies it to all subdomains,
    # and preload allows the domain to be included in browser HSTS preload lists.
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )

    # X-Frame-Options: DENY prevents the page from being embedded in a frame,
    # iframe, embed, or object, helping protect against clickjacking attacks.
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options: nosniff prevents browsers from MIME-sniffing a
    # response away from the declared Content-Type, reducing exposure to certain
    # drive-by download and script execution attacks.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer-Policy: no-referrer prevents the browser from sending the Referer
    # header with requests, protecting potentially sensitive URL information.
    response.headers["Referrer-Policy"] = "no-referrer"

    # Permissions-Policy restricts access to powerful browser features and APIs.
    # Empty parentheses disable the listed features for this site and embedded content.
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), "
        "camera=(), "
        "geolocation=(), "
        "gyroscope=(), "
        "magnetometer=(), "
        "microphone=(), "
        "payment=(), "
        "usb=()"
    )

    return response


@app.route("/")
def index():
    return {"message": "Security headers are applied to every response."}


if __name__ == "__main__":
    app.run()