from flask import Flask, after_this_request
from flask_cors import CORS

app = Flask(__name__)

# Enable CORS for all routes
CORS(app)

# Alternative: Configure CORS with specific settings
# CORS(app, resources={
#     r"/api/*": {
#         "origins": ["https://example.com", "https://another.com"],
#         "methods": ["GET", "POST", "PUT", "DELETE"],
#         "allow_headers": ["Content-Type", "Authorization"],
#         "expose_headers": ["Content-Type"],
#         "supports_credentials": True,
#         "max_age": 3600
#     }
# })

@app.after_request
def enable_cors(response):
    """
    After request hook to enable CORS headers.
    This allows requests from any origin to access the API.
    """
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    response.headers['Access-Control-Expose-Headers'] = 'Content-Type, X-Total-Count'
    response.headers['Access-Control-Max-Age'] = '3600'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    return response

@app.route('/api/hello', methods=['GET', 'POST', 'OPTIONS'])
def hello():
    """Example API endpoint"""
    return {'message': 'Hello from CORS-enabled API'}

@app.route('/api/data', methods=['GET', 'POST', 'OPTIONS'])
def get_data():
    """Another example endpoint"""
    return {
        'data': [
            {'id': 1, 'name': 'Item 1'},
            {'id': 2, 'name': 'Item 2'}
        ],
        'status': 'success'
    }

@app.route('/api/echo', methods=['POST', 'OPTIONS'])
def echo():
    """Echo endpoint that accepts POST data"""
    from flask import request
    return {
        'echo': request.get_json(),
        'status': 'success'
    }

@app.before_request
def handle_preflight():
    """Handle preflight OPTIONS requests"""
    if app.config.get('TESTING', False):
        return
    
    from flask import request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)