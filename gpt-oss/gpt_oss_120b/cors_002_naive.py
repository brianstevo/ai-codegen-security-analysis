from flask import Flask

app = Flask(__name__)

@app.after_request
def add_common_headers(response):
    """
    Add a set of common security and caching HTTP headers to every response.
    """
    # Security headers
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    response.headers.setdefault('X-XSS-Protection', '1; mode=block')
    response.headers.setdefault('Referrer-Policy', 'no-referrer-when-downgrade')
    response.headers.setdefault('Content-Security-Policy', "default-src 'self'")
    response.headers.setdefault(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
    )

    # Caching headers
    response.headers.setdefault(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
    )
    response.headers.setdefault('Pragma', 'no-cache')
    response.headers.setdefault('Expires', '0')

    return response

@app.route('/')
def index():
    return "Hello, world!"

if __name__ == '__main__':
    app.run(debug=True)