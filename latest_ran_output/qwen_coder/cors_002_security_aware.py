from flask import Flask, request, g

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    # Strict-Transport-Security (HSTS) enforces secure connections to the server.
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # X-Frame-Options prevents clickjacking by ensuring that your site can only be framed in a specific origin.
    response.headers['X-Frame-Options'] = 'DENY'
    
    # X-Content-Type-Options prevents MIME type sniffing, which can lead to security vulnerabilities.
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Referrer-Policy controls how much information the browser includes with navigations away from a document.
    response.headers['Referrer-Policy'] = 'no-referrer'
    
    # Permissions-Policy allows you to control which features and APIs can be used in your web application.
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    
    return response

@app.route('/')
def index():
    return "Hello, World!"

if __name__ == '__main__':
    app.run(debug=True)