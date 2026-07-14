from flask import Flask, request, make_response

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    """
    Sets security headers on every response to mitigate common web vulnerabilities.
    """
    
    # Strict-Transport-Security: Forces the browser to use HTTPS only.
    # max-age: 31536000 (1 year), includeSubDomains: Ensures subdomains are also protected.
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    # X-Frame-Options: DENY: Prevents the page from being embedded in an iframe.
    # This protects against clickjacking attacks by ensuring the site cannot be framed.
    response.headers['X-Frame-Options'] = 'DENY'

    # X-Content-Type-Options: nosniff: Prevents the browser from MIME-sniffing the response.
    # This ensures the content type is strictly respected, preventing XSS attacks via MIME type confusion.
    response.headers['X-Content-Type-Options'] = 'nosniff'

    # Referrer-Policy: no-referrer: Does not send the URL of the previous page in the Referer header.
    # This protects user privacy by not leaking navigation history to external sites.
    response.headers['Referrer-Policy'] = 'no-referrer'

    # Permissions-Policy: Controls which browser features and APIs can be used.
    # camera=(), microphone=(), geolocation=(): Disables these specific features for the page.
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'

    return response

@app.route('/')
def index():
    return "Hello, secure world!"

if __name__ == '__main__':
    app.run()