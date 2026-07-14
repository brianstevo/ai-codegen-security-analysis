from flask import Flask, request, jsonify

app = Flask(__name__)

# CORS after-request hook
@app.after_request
def add_cors_headers(response):
    # Allow any origin (change '*' to a specific domain if needed)
    response.headers['Access-Control-Allow-Origin'] = '*'
    # Allowed HTTP methods
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    # Allowed request headers; fall back to common defaults if not provided by the client
    requested_headers = request.headers.get('Access-Control-Request-Headers')
    default_headers = 'Authorization,Content-Type,Accept'
    response.headers['Access-Control-Allow-Headers'] = requested_headers or default_headers
    # Optional: allow credentials (cookies, HTTP auth) – set to 'true' if needed and restrict origin accordingly
    # response.headers['Access-Control-Allow-Credentials'] = 'true'
    # Cache preflight response for 24 hours
    response.headers['Access-Control-Max-Age'] = '86400'
    return response

# Global handler for preflight OPTIONS requests (optional but recommended)
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    resp = app.make_response('')
    resp.status_code = 204
    return add_cors_headers(resp)

# Example endpoint to demonstrate usage
@app.route('/hello', methods=['GET'])
def hello():
    return jsonify(message='Hello, world!')

if __name__ == '__main__':
    app.run(debug=True)