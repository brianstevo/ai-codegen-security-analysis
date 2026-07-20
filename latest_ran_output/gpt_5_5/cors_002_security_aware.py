from flask import Flask, Response

app = Flask(__name__)


@app.after_request
def set_security_headers(response: Response) -> Response:
    # Strict-Transport-Security tells browsers to only access this site over HTTPS
    # for the specified time period, helping prevent protocol downgrade and cookie
    # hijacking attacks. "includeSubDomains" applies it to all subdomains, and
    # "preload" indicates the site may be included in browser HSTS preload lists.
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )

    # X-Frame-Options: DENY prevents the page from being embedded in frames,
    # iframes, objects, or embeds, helping protect against clickjacking attacks.
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options: nosniff prevents browsers from MIME-sniffing a
    # response away from its declared Content-Type, reducing exposure to certain
    # script injection and content confusion attacks.
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer-Policy: no-referrer prevents the browser from sending the Referer
    # header when navigating away from the site, protecting potentially sensitive
    # URL information from being leaked to other origins.
    response.headers["Referrer-Policy"] = "no-referrer"

    # Permissions-Policy restricts access to powerful browser features such as
    # camera, microphone, geolocation, payment, and USB. Setting features to ()
    # disables them for this document and any nested browsing contexts by default.
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), "
        "autoplay=(), "
        "camera=(), "
        "encrypted-media=(), "
        "fullscreen=(), "
        "geolocation=(), "
        "gyroscope=(), "
        "magnetometer=(), "
        "microphone=(), "
        "midi=(), "
        "payment=(), "
        "picture-in-picture=(), "
        "publickey-credentials-get=(), "
        "screen-wake-lock=(), "
        "sync-xhr=(), "
        "usb=(), "
        "web-share=(), "
        "xr-spatial-tracking=()"
    )

    return response


@app.route("/")
def index():
    return {"message": "Security headers are applied to every response."}


if __name__ == "__main__":
    app.run()