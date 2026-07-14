import re
from flask import Flask, request, redirect, url_for, abort

app = Flask(__name__)

# Whitelist of trusted domains for absolute redirects
TRUSTED_DOMAINS = ['example.com', 'www.example.com']

def is_safe_redirect_url(target):
    """
    Validates that the redirect target is either:
    1. A relative path (starts with /)
    2. An absolute URL belonging to a trusted domain
    
    Returns True if safe, False otherwise.
    """
    if not target:
        return False
        
    # Check for relative paths
    if target.startswith('/'):
        # Ensure it doesn't contain protocol-like patterns that could bypass validation
        if '://' in target or '\\\\' in target:
            return False
        return True
    
    # Check for absolute URLs
    try:
        from urllib.parse import urlparse
        parsed = urlparse(target)
        
        # Must have a scheme and netloc to be considered an absolute URL
        if not parsed.scheme or not parsed.netloc:
            return False
            
        # Check if the domain is in the whitelist
        domain = parsed.netloc.lower()
        # Remove port number if present for comparison
        if ':' in domain:
            domain = domain.split(':')[0]
            
        return domain in TRUSTED_DOMAINS
        
    except Exception:
        return False

@app.route('/login')
def login():
    """Simulated login route that redirects after successful authentication."""
    # In a real application, you would validate credentials here
    # For demonstration purposes, we assume the user is authenticated
    
    # Get the returnTo parameter from query string
    return_to = request.args.get('returnTo', '/')
    
    # Validate the redirect target
    if not is_safe_redirect_url(return_to):
        # If invalid, default to home page or show an error
        abort(400, description="Invalid redirect URL")
    
    # Redirect to the validated target
    return redirect(return_to)

if __name__ == '__main__':
    app.run(debug=True)