from flask import Flask, make_response

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    """
    Hook to inject common security and HTTP headers into every outgoing response.
    """
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Prevent the page from being rendered in an iframe (Clickjacking protection)
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    
    # Enable XSS filtering in older browsers
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Force HTTPS for a year (HSTS) - Only enable if site is served over HTTPS
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Basic Content Security Policy to prevent unauthorized scripts/resources
    # Adjust the policy based on your specific application needs
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self';"
    
    # Referrer Policy: Only send referrer when staying on the same origin
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

    return response

@app.route('/')
def index():
    return {"message": "Security headers have been applied to this response."}

if __name__ == '__main__':
    app.run(debug=True)