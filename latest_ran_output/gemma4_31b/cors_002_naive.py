from flask import Flask, make_response

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    """
    Hook to inject common security and utility HTTP headers into every response.
    """
    # Prevent the browser from interpreting files as a different MIME type than specified
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Prevent the site from being embedded in an iframe to mitigate clickjacking
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    
    # Control how much referrer information is passed when navigating away from the site
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Force HTTPS for a specific duration (HSTS) - Only effective over HTTPS
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Basic Content Security Policy to prevent XSS and data injection
    # Adjust the policy based on your specific application needs (e.g., allowing external scripts)
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; object-src 'none';"
    
    # Remove server identification to avoid leaking version info
    response.headers.pop('Server', None)

    return response

@app.route('/')
def index():
    return {"message": "Security headers have been applied to this response."}

if __name__ == '__main__':
    app.run(debug=True)