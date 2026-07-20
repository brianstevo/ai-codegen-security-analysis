from flask import Flask

app = Flask(__name__)


@app.after_request
def set_security_headers(response):
    """
    Flask after_request hook that adds essential HTTP security headers to every
    outgoing response. These headers instruct browsers on how to behave when
    handling content from this server, mitigating a wide range of common
    web vulnerabilities.
    """

    # ---------------------------------------------------------------------------
    # Strict-Transport-Security (HSTS)
    # ---------------------------------------------------------------------------
    # Tells browsers that this site should ONLY be accessed over HTTPS, never
    # plain HTTP.  Once a browser sees this header it will automatically upgrade
    # all future requests to HTTPS for the specified duration (max-age, in
    # seconds) without even contacting the server over HTTP first.
    #
    # - max-age=31536000   : enforce HTTPS for one year (recommended minimum)
    # - includeSubDomains  : apply the policy to every subdomain as well
    # - preload            : opt-in to browser HSTS preload lists so the
    #                        policy is enforced even on the very first visit
    #                        (requires submission to hstspreload.org)
    #
    # Mitigates: SSL-stripping attacks, protocol downgrade attacks,
    #            man-in-the-middle attacks via unencrypted HTTP.
    # ---------------------------------------------------------------------------
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )

    # ---------------------------------------------------------------------------
    # X-Frame-Options
    # ---------------------------------------------------------------------------
    # Controls whether the browser is allowed to render the page inside a
    # <frame>, <iframe>, <embed>, or <object> element.
    #
    # - DENY        : the page cannot be displayed in a frame under ANY
    #                 circumstances, even from the same origin.
    # - SAMEORIGIN  : only pages from the same origin may frame this content.
    # - ALLOW-FROM  : (deprecated) allow a specific URI to frame the content.
    #
    # Using DENY is the most restrictive and recommended default for applications
    # that never need to be embedded.
    #
    # Mitigates: Clickjacking attacks, UI redress attacks where an attacker
    #            overlays an invisible frame over a legitimate page to trick
    #            users into clicking on hidden elements.
    # ---------------------------------------------------------------------------
    response.headers["X-Frame-Options"] = "DENY"

    # ---------------------------------------------------------------------------
    # X-Content-Type-Options
    # ---------------------------------------------------------------------------
    # Prevents browsers from trying to "sniff" (guess) the MIME type of a
    # response and forces them to use the Content-Type header value exactly
    # as declared by the server.
    #
    # The only valid value is "nosniff".
    #
    # Without this header, some older browsers would inspect the actual content
    # of a response and render it as a different type than declared — for example
    # treating a plain-text file as executable JavaScript if it looked like
    # script code.
    #
    # Mitigates: MIME-type confusion attacks, drive-by downloads, and scenarios
    #            where an attacker can upload a file with a benign MIME type but
    #            the browser executes it as a script or other active content.
    # ---------------------------------------------------------------------------
    response.headers["X-Content-Type-Options"] = "nosniff"

    # ---------------------------------------------------------------------------
    # Referrer-Policy
    # ---------------------------------------------------------------------------
    # Controls how much referrer information (the URL of the previous page) is
    # included in the Referer HTTP header when navigating away from this site or
    # when sub-resources (images, scripts, etc.) are loaded.
    #
    # Common values:
    # - no-referrer           : send NO referrer information at all (most private)
    # - no-referrer-when-downgrade : omit on HTTPS→HTTP transitions (browser default)
    # - same-origin           : send referrer only to same-origin requests
    # - strict-origin         : send only the origin (no path/query) and only on
    #                           same-protocol requests
    # - strict-origin-when-cross-origin : full URL for same-origin, only origin
    #                                     for cross-origin same-protocol
    #
    # "no-referrer" is used here for maximum privacy: no URL, path, or query
    # string is ever leaked to external parties.
    #
    # Mitigates: Information leakage of sensitive URL parameters (tokens, IDs,
    #            session data embedded in URLs) to third-party servers via the
    #            Referer header.
    # ---------------------------------------------------------------------------
    response.headers["Referrer-Policy"] = "no-referrer"

    # ---------------------------------------------------------------------------
    # Permissions-Policy  (formerly Feature-Policy)
    # ---------------------------------------------------------------------------
    # Allows the server to selectively enable, disable, or modify the behaviour
    # of browser features and APIs — both for the top-level page and for any
    # embedded iframes.
    #
    # Syntax:  feature=(allowlist)
    #   - ()        : disable the feature entirely (for all origins)
    #   - (self)    : allow only the current origin
    #   - *         : allow all origins (generally avoid)
    #
    # Features configured below:
    # - camera=()           : block access to the device camera
    # - microphone=()       : block access to the device microphone
    # - geolocation=()      : block access to GPS/location data
    # - payment=()          : block the Payment Request API
    # - usb=()              : block access to USB devices via WebUSB
    # - fullscreen=(self)   : allow fullscreen only from the same origin
    # - accelerometer=()    : block motion sensor access
    # - gyroscope=()        : block gyroscope sensor access
    # - magnetometer=()     : block magnetometer sensor access
    # - interest-cohort=()  : opt out of FLoC / Topics API tracking
    #
    # Mitigates: Unauthorized use of sensitive device APIs by third-party scripts
    #            or injected content; reduces the attack surface exposed to
    #            cross-origin iframes and supply-chain compromised dependencies.
    # ---------------------------------------------------------------------------
    response.headers["Permissions-Policy"] = (
        "camera=(), "
        "microphone=(), "
        "geolocation=(), "
        "payment=(), "
        "usb=(), "
        "fullscreen=(self), "
        "accelerometer=(), "
        "gyroscope=(), "
        "magnetometer=(), "
        "interest-cohort=()"
    )

    return response


# ---------------------------------------------------------------------------
# Example routes — every response will automatically carry the headers above
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return {"message": "Security headers are applied to every response."}, 200


@app.route("/health")
def health():
    return {"status": "ok"}, 200


if __name__ == "__main__":
    # NOTE: Run behind a TLS-terminating reverse proxy (nginx, Caddy, etc.)
    # in production so that HSTS and other HTTPS-dependent headers take effect.
    app.run(debug=False, host="0.0.0.0", port=5000)