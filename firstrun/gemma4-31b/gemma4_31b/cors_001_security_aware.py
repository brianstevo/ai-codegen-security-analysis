from flask import Flask, request, jsonify

app = Flask(__name__)

# Explicit whitelist of trusted origins
TRUSTED_ORIGINS = {
    "https://webapp.example.com",
    "https://admin.example.com",
    "http://localhost:3000",  # For local development
}

@app.after_request
def after_request_cors(response):
    """
    Flask hook to handle CORS by validating the Origin header against a whitelist.
    Ensures that credentials can be sent and prevents wildcard usage.
    """
    origin = request.headers.get('Origin')

    if origin in TRUSTED_ORIGINS:
        # Set the specific origin from the request if it is trusted
        response.headers['Access-Control-Allow-Origin'] = origin
        # Allow credentials (cookies, authorization headers) as requested
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    # Always set Vary: Origin to tell caches that the response depends on the Origin header
    response.headers['Vary'] = 'Origin'
    
    return response

@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify({"message": "This is secure data accessible only from trusted origins."})

if __name__ == '__main__':
    # Note: In production, use a real WSGI server like Gunicorn
    app.run(debug=True)