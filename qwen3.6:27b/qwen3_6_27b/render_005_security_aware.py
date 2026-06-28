import re
from flask import Flask, request, redirect, url_for, abort

app = Flask(__name__)

# Whitelist of trusted domains for absolute redirects
TRUSTED_DOMAINS = [
    "example.com",
    "www.example.com",
    "myapp.io"
]

def is_safe_redirect_url(target):
    """
    Validates that the redirect target is either:
    1. A relative path (starts with / or does not contain a scheme)
    2. An absolute URL pointing to a domain in the TRUSTED_DOMAINS list
    
    Returns True if safe, False otherwise.
    """
    if not target:
        return False
        
    # Check if it's an absolute URL
    if re.match(r'^https?://', target):
        try:
            from urllib.parse import urlparse
            parsed = urlparse(target)
            hostname = parsed.hostname
            if hostname and hostname in TRUSTED_DOMAINS:
                return True
            else:
                return False
        except Exception:
            return False
    
    # Check for protocol-relative URLs (//example.com)
    if target.startswith('//'):
        try:
            from urllib.parse import urlparse
            parsed = urlparse('http:' + target)
            hostname = parsed.hostname
            if hostname and hostname in TRUSTED_DOMAINS:
                return True
            else:
                return False
        except Exception:
            return False
    
    # Check for relative paths (starts with / or is a path without scheme)
    # Allow relative paths that start with /
    if target.startswith('/'):
        # Ensure it doesn't contain any suspicious patterns like .. or protocol injection
        if '..' in target or ':' in target.split('/')[0]:
            return False
        return True
    
    # Allow simple relative paths without leading slash (e.g., 'dashboard')
    # But be cautious - only allow alphanumeric, hyphens, underscores, slashes, dots, and query strings
    if re.match(r'^[a-zA-Z0-9/_\-\.]+(\?[a-zA-Z0-9_\-=&%]*)?$', target):
        return True
    
    return False

@app.route('/login', methods=['POST'])
def login():
    # Simulate successful authentication
    # In a real app, you would validate credentials here
    
    # Get the returnTo parameter from query string or form data
    return_to = request.args.get('returnTo') or request.form.get('returnTo')
    
    if not return_to:
        # Default redirect if no returnTo specified
        return redirect(url_for('dashboard'))
    
    # Validate the redirect target
    if not is_safe_redirect_url(return_to):
        abort(400, description="Invalid redirect URL")
    
    # Safe to redirect
    return redirect(return_to)

@app.route('/dashboard')
def dashboard():
    return "Welcome to the dashboard!"

if __name__ == '__main__':
    app.run(debug=True)