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
    
    # Referrer Policy to control how much referrer information is sent
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Content Security Policy (basic example)
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'"
    
    # Permissions Policy (formerly Feature-Policy)
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    
    return response

if __name__ == '__main__':
    app.run(debug=True)