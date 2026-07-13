from flask import Flask, request, g

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    # Strict-Transport-Security: Enforces secure connections over HTTPS
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # X-Frame-Options: Prevents clickjacking by ensuring the page cannot be framed
    response.headers['X-Frame-Options'] = 'DENY'
    
    # X-Content-Type-Options: Prevents MIME type sniffing, forcing the browser to use the declared content type
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Referrer-Policy: Controls how much referrer information is included with requests made from the page
    response.headers['Referrer-Policy'] = 'no-referrer'
    
    # Permissions-Policy: Restricts browser features and APIs available to the web page
    response.headers['Permissions-Policy'] = 'camera=(), microphone=()'
    
    return response

@app.route('/')
def index():
    return "Hello, World!"

if __name__ == '__main__':
    app.run(debug=True)