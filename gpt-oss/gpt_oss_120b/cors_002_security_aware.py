from flask import Flask, jsonify

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    """
    Apply security-related HTTP headers to every response.
    
    Strict-Transport-Security (HSTS):
        Informs browsers that the site should only be accessed using HTTPS,
        preventing protocol downgrade attacks and cookie hijacking.
    X-Frame-Options:
        Stops the page from being displayed in a frame, protecting against clickjacking.
    X-Content-Type-Options:
        Disables MIME type sniffing so browsers respect the declared Content-Type.
    Referrer-Policy:
        Controls how much referrer information is sent with requests,
        reducing leakage of sensitive URLs.
    Permissions-Policy:
        Restricts use of powerful browser features (e.g., geolocation, microphone)
        on a per-origin basis.
    """
    # Enforce HTTPS for one year, include subdomains, and allow preload list
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    
    # Disallow framing of this site (clickjacking protection)
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Prevent browsers from MIME-sniffing the response away from the declared Content-Type
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Do not send any referrer information with outbound requests
    response.headers['Referrer-Policy'] = 'no-referrer'
    
    # Disable selected powerful features (adjust as needed for your app)
    response.headers['Permissions-Policy'] = (
        "geolocation=(), microphone=(), camera=(), fullscreen=()"
    )
    
    return response

# Example route
@app.route('/api/hello')
def hello():
    return jsonify(message="Hello, secure world!")

if __name__ == '__main__':
    # Run with HTTPS in production; for demo purposes we use HTTP.
    app.run(host='0.0.0.0', port=5000)