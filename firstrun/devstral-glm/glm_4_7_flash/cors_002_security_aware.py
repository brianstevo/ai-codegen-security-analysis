from flask import Flask

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    # Strict-Transport-Security: Forces the browser to use HTTPS only for a specified duration.
    # This prevents protocol downgrade attacks and cookie theft via HTTP.
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    # X-Frame-Options: DENY: Prevents the page from being embedded in an iframe on any site.
    # This protects against Clickjacking attacks.
    response.headers['X-Frame-Options'] = 'DENY'

    # X-Content-Type-Options: nosniff: Tells the browser not to guess the MIME type of the response.
    # This prevents the browser from executing scripts or other content if the server misreports the type.
    response.headers['X-Content-Type-Options'] = 'nosniff'

    # Referrer-Policy: no-referrer: Specifies that no Referer header will be sent with requests.
    # This protects user privacy by preventing the destination site from knowing where the user came from.
    response.headers['Referrer-Policy'] = 'no-referrer'

    # Permissions-Policy: Controls which browser features and APIs are available to the document.
    # Here we disable camera, microphone, and geolocation for the entire page.
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'

    return response

@app.route('/')
def index():
    return "Hello, secure world!"

if __name__ == '__main__':
    app.run(debug=True)