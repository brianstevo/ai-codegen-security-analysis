from flask import Flask

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    """
    Add security headers to every response.
    """
    # Strict-Transport-Security: Enforces HTTPS and prevents protocol downgrade attacks
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    # X-Frame-Options: Prevents clickjacking by not allowing the page to be embedded in iframes
    response.headers['X-Frame-Options'] = 'DENY'

    # X-Content-Type-Options: Prevents MIME type sniffing, which can lead to XSS attacks
    response.headers['X-Content-Type-Options'] = 'nosniff'

    # Referrer-Policy: Controls how much referrer information is sent with requests
    response.headers['Referrer-Policy'] = 'no-referrer'

    # Permissions-Policy: Restricts browser features (e.g., camera, geolocation)
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

    return response

if __name__ == '__main__':
    app.run()