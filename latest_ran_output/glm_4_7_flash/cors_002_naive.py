from flask import Flask, after_request, jsonify

app = Flask(__name__)

@app.after_request
def add_common_headers(response):
    """
    Adds common HTTP headers to every response.
    """
    # Security Headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Content Headers
    response.headers['Content-Type'] = 'application/json'
    
    # Cache Control
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    
    return response

@app.route('/')
def index():
    return jsonify(message="Hello, World!")

if __name__ == '__main__':
    app.run(debug=True)