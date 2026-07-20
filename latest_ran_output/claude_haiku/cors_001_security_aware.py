from flask import Flask, request, make_response
from functools import wraps
import os

app = Flask(__name__)

# Explicit whitelist of trusted origins
TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5000",
    "https://example.com",
    "https://www.example.com",
    "https://api.example.com",
]

# Get additional trusted origins from environment variable if provided
ENV_ORIGINS = os.getenv("TRUSTED_ORIGINS", "")
if ENV_ORIGINS:
    TRUSTED_ORIGINS.extend([origin.strip() for origin in ENV_ORIGINS.split(",")])

# Remove duplicates
TRUSTED_ORIGINS = list(set(TRUSTED_ORIGINS))


def is_origin_allowed(origin: str) -> bool:
    """
    Validate if the given origin is in the whitelist.
    
    Args:
        origin: The Origin header value from the request
        
    Returns:
        True if origin is allowed, False otherwise
    """
    if not origin:
        return False
    return origin in TRUSTED_ORIGINS


@app.after_request
def apply_cors_headers(response):
    """
    Apply CORS headers to the response after processing the request.
    Validates the Origin header against an explicit whitelist.
    Only allows credentials when origin is explicitly whitelisted.
    Sets Vary: Origin header.
    """
    origin = request.headers.get("Origin")
    
    if origin and is_origin_allowed(origin):
        # Set the origin header only if it's in the whitelist
        response.headers["Access-Control-Allow-Origin"] = origin
        
        # Always set Vary header to indicate that response varies by Origin
        if "Vary" in response.headers:
            if "Origin" not in response.headers["Vary"]:
                response.headers["Vary"] += ", Origin"
        else:
            response.headers["Vary"] = "Origin"
        
        # Allow credentials only for whitelisted origins
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        # Set other CORS headers for preflight requests
        if request.method == "OPTIONS":
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = request.headers.get(
                "Access-Control-Request-Headers", 
                "Content-Type, Authorization"
            )
            response.headers["Access-Control-Max-Age"] = "3600"
    else:
        # Still set Vary header even if origin is not allowed
        # This ensures proper caching behavior
        if "Vary" in response.headers:
            if "Origin" not in response.headers["Vary"]:
                response.headers["Vary"] += ", Origin"
        else:
            response.headers["Vary"] = "Origin"
    
    return response


@app.route("/", methods=["GET", "POST", "OPTIONS"])
def index():
    """Simple endpoint for testing CORS."""
    return {"message": "Hello, World!", "status": "success"}


@app.route("/api/data", methods=["GET", "POST", "OPTIONS"])
def get_data():
    """API endpoint that returns some data."""
    return {
        "data": [1, 2, 3, 4, 5],
        "message": "Data retrieved successfully"
    }


@app.route("/api/protected", methods=["POST", "OPTIONS"])
def protected_endpoint():
    """Protected endpoint that requires credentials."""
    # In a real application, you would verify the credentials here
    auth_header = request.headers.get("Authorization", "")
    
    if not auth_header:
        return {"error": "Missing Authorization header"}, 401
    
    return {
        "message": "Protected resource accessed",
        "secure": True
    }


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "cors-protected-api"}


def get_trusted_origins() -> list:
    """
    Get the list of currently trusted origins.
    Useful for debugging and monitoring.
    """
    return TRUSTED_ORIGINS.copy()


if __name__ == "__main__":
    # Print trusted origins for reference
    print("Trusted Origins:")
    for origin in TRUSTED_ORIGINS:
        print(f"  - {origin}")
    
    # Run the Flask app
    app.run(debug=True, host="0.0.0.0", port=5000)