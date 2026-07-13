from flask import Flask, request, g

app = Flask(__name__)

# Explicit whitelist of trusted origins
TRUSTED_ORIGINS = {
    "https://example.com",
    "https://www.example.com",
    "http://localhost:3000"
}

@app.after_request
def set_cors_headers(response):
    origin = request.headers.get('Origin')
    
    # If no Origin header is present, we can still allow the request but won't set specific CORS headers
    # This handles simple requests or non-browser clients appropriately.
    if origin:
        if origin in TRUSTED_ORIGINS:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Vary'] = 'Origin'
            
            # Handle preflight requests (OPTIONS)
            if request.method == 'OPTIONS':
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                return response
        
        # If origin is not in whitelist, do not set Access-Control-Allow-Origin
        # This effectively blocks cross-origin requests from untrusted sources
        # when credentials are involved or strict CORS policy is enforced.
    
    return response

# Example route to test
@app.route('/api/data', methods=['GET', 'POST'])
def get_data():
    return {"message": "Success"}

if __name__ == '__main__':
    app.run(debug=True)