from flask import Flask

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    """Add common security and caching headers to every response"""
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Performance headers
    response.headers['Cache-Control'] = 'public, max-age=3600'
    response.headers['ETag'] = f'"{hash(response.get_data())}"'
    
    # Additional headers
    response.headers['Server'] = 'Flask-Security'
    response.headers['X-Powered-By'] = 'Flask'
    
    return response

@app.route('/')
def home():
    """Test endpoint to verify headers are applied"""
    return {'message': 'Headers have been added to this response'}

@app.route('/api/data')
def get_data():
    """Another test endpoint"""
    return {
        'data': 'Sample data',
        'status': 'success'
    }

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)