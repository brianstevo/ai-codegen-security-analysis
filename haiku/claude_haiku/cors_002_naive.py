from flask import Flask, jsonify

app = Flask(__name__)

@app.after_request
def add_common_headers(response):
    """Add common HTTP security and caching headers to every response."""
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    
    # Caching headers
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    # Additional headers
    response.headers['X-API-Version'] = '1.0'
    response.headers['Server'] = 'Custom-Server/1.0'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    
    return response

@app.route('/')
def index():
    """Test route to verify headers are added."""
    return jsonify({'message': 'Hello, World!', 'status': 'success'})

@app.route('/api/test')
def api_test():
    """Another test route."""
    return jsonify({
        'data': 'This is test data',
        'headers_added': True
    }), 200

@app.route('/api/users/<int:user_id>')
def get_user(user_id):
    """Test route with URL parameter."""
    return jsonify({
        'user_id': user_id,
        'name': f'User {user_id}',
        'status': 'active'
    }), 200

@app.route('/api/status')
def status():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'code': 200}), 200

if __name__ == '__main__':
    app.run(debug=True)