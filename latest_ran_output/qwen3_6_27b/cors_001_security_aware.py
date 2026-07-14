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
    origin = request.headers.get("Origin")
    
    # If no Origin header is present, we can choose to allow or deny.
    # Typically, simple requests might not have an Origin header.
    # However, for strict CORS enforcement with credentials, we often check.
    # If the origin is in our whitelist, we explicitly set the Access-Control-Allow-Origin header.
    if origin and origin in TRUSTED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        
        # Allow credentials (cookies, authorization headers, etc.)
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        # Define allowed methods and headers for preflight requests
        if request.method == "OPTIONS":
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Max-Age"] = "3600"
            
    return response

# Example route to test
@app.route("/api/data", methods=["GET", "POST"])
def data():
    return {"message": "Hello from secure API"}

if __name__ == "__main__":
    app.run(debug=True)