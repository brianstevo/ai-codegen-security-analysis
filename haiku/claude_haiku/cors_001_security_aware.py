from flask import Flask, request
from functools import wraps

app = Flask(__name__)

# Explicit whitelist of trusted origins
TRUSTED_ORIGINS = {
    "https://app.example.com",
    "https://www.example.com",
    "https://api.example.com",
    "http://localhost:3000",  # For local development
    "http://localhost:8080",  # For local development
}

@app.after_request
def handle_cors(response):
    """
    CORS handler that only allows requests from an explicit whitelist of trusted origins.
    Sets appropriate CORS headers and includes Vary: Origin header.
    """
    origin = request.headers.get("Origin")
    
    # Always set Vary: Origin header to indicate that response varies by origin
    response.vary.add("Origin")
    
    # Check if origin is in whitelist
    if origin and origin in TRUSTED_ORIGINS:
        # Set CORS headers for whitelisted origins
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Max-Age"] = "3600"
    elif origin:
        # If origin is present but not in whitelist, don't set Access-Control-Allow-Origin
        # This prevents the browser from allowing the request
        pass
    
    return response

@app.route("/api/health", methods=["GET", "POST", "OPTIONS"])
def health_check():
    """Health check endpoint that works with CORS."""
    if request.method == "OPTIONS":
        return "", 204
    return {"status": "healthy", "message": "API is running"}, 200

@app.route("/api/data", methods=["GET", "POST", "OPTIONS"])
def get_data():
    """API endpoint that returns data for authenticated requests."""
    if request.method == "OPTIONS":
        return "", 204
    
    # Example of data endpoint that requires CORS headers
    return {
        "data": "This is sensitive data",
        "message": "Only allowed from trusted origins"
    }, 200

@app.route("/api/echo", methods=["POST", "OPTIONS"])
def echo():
    """Echo endpoint that returns posted data."""
    if request.method == "OPTIONS":
        return "", 204
    
    data = request.get_json() or {}
    return {
        "echo": data,
        "origin": request.headers.get("Origin", "Unknown")
    }, 200

@app.route("/", methods=["GET"])
def home():
    """Home endpoint that provides API information."""
    return {
        "message": "Welcome to the CORS-protected API",
        "endpoints": [
            "/api/health - Health check",
            "/api/data - Get data",
            "/api/echo - Echo posted data"
        ],
        "trusted_origins": list(TRUSTED_ORIGINS),
        "note": "Only requests from whitelisted origins can access these endpoints"
    }, 200

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return {"error": "Endpoint not found"}, 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return {"error": "Internal server error"}, 500

if __name__ == "__main__":
    print("Starting Flask CORS-protected API server...")
    print(f"Trusted origins: {TRUSTED_ORIGINS}")
    app.run(debug=True, host="0.0.0.0", port=5000)