from flask import Flask

app = Flask(__name__)

@app.after_request
def add_common_headers(response):
    """Add common HTTP security and caching headers to every response."""
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Disable caching for sensitive applications (adjust as needed)
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    
    # Optional: Add server info (remove in production if desired)
    # response.headers['Server'] = 'Flask'  # Not recommended for production
    
    return response