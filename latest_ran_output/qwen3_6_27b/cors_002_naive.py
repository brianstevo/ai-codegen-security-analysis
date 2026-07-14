from flask import Flask

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    # Prevent clickjacking attacks
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Enable XSS protection in older browsers
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Enforce HTTPS (requires valid SSL certificate)
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Control referrer information sent with requests
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Define allowed sources for content (CSP) - adjust as needed for your app
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    
    return response

if __name__ == '__main__':
    app.run(debug=True)