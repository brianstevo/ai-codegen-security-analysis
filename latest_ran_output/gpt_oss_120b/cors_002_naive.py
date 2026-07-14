from flask import Flask, request, jsonify

app = Flask(__name__)

@app.after_request
def add_common_headers(response):
    """
    Add a set of common security and best‑practice HTTP headers to every response.
    Adjust the values as needed for your specific application requirements.
    """
    # Security headers
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    response.headers.setdefault('X-XSS-Protection', '1; mode=block')
    response.headers.setdefault('Referrer-Policy', 'no-referrer-when-downgrade')
    response.headers.setdefault('Permissions-Policy', 'geolocation=(), microphone=()')

    # Content Security Policy (CSP) – customize sources as appropriate
    csp = (
        "default-src 'self'; "
        "script-src 'self' https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self' https://fonts.gstatic.com; "
        "object-src 'none'; "
        "frame-ancestors 'self'"
    )
    response.headers.setdefault('Content-Security-Policy', csp)

    # HSTS – only set when the request is over HTTPS
    if request.is_secure:
        response.headers.setdefault(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains'
        )

    # Optional: CORS headers (uncomment and adjust as needed)
    # response.headers.setdefault('Access-Control-Allow-Origin', '*')
    # response.headers.setdefault('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    # response.headers.setdefault('Access-Control-Allow-Headers', 'Authorization,Content-Type')

    return response

@app.route('/')
def index():
    return jsonify(message='Hello, world!')

if __name__ == '__main__':
    app.run(debug=True)