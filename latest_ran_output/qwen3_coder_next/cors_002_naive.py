from flask import Flask

app = Flask(__name__)

@app.after_request
def add_common_headers(response):
    """Add common HTTP headers to every response."""
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Enable XSS filtering in browsers
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Prevent clickjacking attacks
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Standard security headers
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    
    # Remove server identification
    response.headers.pop('Server', None)
    
    return response