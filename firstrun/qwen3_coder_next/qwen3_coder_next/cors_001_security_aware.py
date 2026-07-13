from flask import Flask, request, make_response

app = Flask(__name__)

# Explicitly define trusted origins (should be configured securely, e.g., from environment variables)
TRUSTED_ORIGINS = {
    "https://example.com",
    "https://api.example.com",
    "https://trusted-partner.com"
}

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    
    # Only process if Origin header is present and matches a trusted origin
    if origin and origin in TRUSTED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        
        # Include additional CORS headers as needed (adjust based on requirements)
        # Note: Do not use wildcard '*' when credentials are involved
        if request.method == "OPTIONS":
            # Handle preflight requests
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Max-Age"] = "86400"  # Cache preflight for 24 hours
    
    return response