from flask import Flask

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    # Strict-Transport-Security (HSTS): Instructs browsers to only access the site over HTTPS,
    # preventing protocol downgrade attacks and cookie hijacking. 'max-age' is in seconds.
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    # X-Frame-Options: Prevents the page from being displayed in a frame, iframe, embed, or object,
    # protecting against clickjacking attacks. 'DENY' means it cannot be framed by any site.
    response.headers['X-Frame-Options'] = 'DENY'

    # X-Content-Type-Options: Prevents browsers from MIME-sniffing a response away from the declared content-type,
    # reducing exposure to drive-by download attacks and XSS via content type confusion.
    response.headers['X-Content-Type-Options'] = 'nosniff'

    # Referrer-Policy: Controls how much referrer information is sent with requests,
    # helping to prevent leaking sensitive URL data to third-party sites. 'no-referrer' sends no referrer info.
    response.headers['Referrer-Policy'] = 'no-referrer'

    # Permissions-Policy (formerly Feature-Policy): Allows the site to control which browser features and APIs
    # can be used by the page or its iframes, enhancing security by disabling unnecessary capabilities.
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'

    return response

if __name__ == '__main__':
    app.run(debug=True)