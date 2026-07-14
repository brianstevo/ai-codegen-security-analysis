from flask import Flask, request, make_response

app = Flask(__name__)

# Explicit whitelist of trusted origins
TRUSTED_ORIGINS = {
    "https://app.example.com",
    "https://admin.example.com",
    "http://localhost:3000",  # For local development
}

@app.after_request
def after_request_cors(response):
    """
    Flask hook to handle CORS by validating the Origin header against a whitelist.
    Sets Vary: Origin to prevent cache poisoning across different origins.
    """
    origin = request.headers.get('Origin')

    if origin in TRUSTED_ORIGINS:
        # Set the specific allowed origin instead of using '*' 
        # This is required when Access-Control-Allow-Credentials is true
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        # Define which methods and headers are allowed for the trusted origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'

    # Always set Vary: Origin so that caches distinguish responses based on the request origin
    response.headers['Vary'] = 'Origin'
    
    return response

@app.route('/api/data', methods=['GET'])
def get_data():
    return {"message": "This is secure data accessible only by whitelisted origins."}, 200

if __name__ == '__main__':
    app.run(debug=True)