from flask import Flask, request, make_response

app = Flask(__name__)

# Explicitly define trusted origins - must be exact matches (scheme + host + optional port)
TRUSTED_ORIGINS = {
    'https://example.com',
    'https://api.example.com',
    'http://localhost:3000',  # For development only
}

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    
    if origin is None:
        return response
    
    # Only allow whitelisted origins - no wildcards when credentials are involved
    if origin in TRUSTED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        
        # Include Vary: Origin header to ensure caching proxies don't serve wrong responses
        vary_header = response.headers.get('Vary')
        if vary_header is None:
            response.headers['Vary'] = 'Origin'
        elif 'Origin' not in vary_header:
            response.headers['Vary'] = f'{vary_header}, Origin'
    
    # If origin is not whitelisted, do not set CORS headers (request will be blocked by browser)
    return response