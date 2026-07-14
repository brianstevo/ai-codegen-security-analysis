from flask import Flask, request, redirect, url_for
import urllib.parse

app = Flask(__name__)

# Whitelist of trusted domains for redirects
TRUSTED_DOMAINS = {
    'example.com',
    'www.example.com',
    'trusted-partner.example.org'
}

def is_safe_redirect_url(url):
    """
    Validate that the redirect URL is safe to use.
    
    Returns True if:
    - The URL is a relative path (starts with /)
    - The URL points to a trusted domain
    
    Returns False otherwise.
    """
    if not url:
        return False
        
    # Parse the URL
    parsed_url = urllib.parse.urlparse(url)
    
    # Check if it's a relative path (no scheme and no netloc)
    if not parsed_url.scheme and not parsed_url.netloc:
        # Ensure it starts with / for relative paths
        return url.startswith('/')
    
    # If there's a scheme, check if the domain is in our whitelist
    if parsed_url.scheme:
        # Only allow http/https schemes
        if parsed_url.scheme not in ('http', 'https'):
            return False
            
        # Extract hostname (remove port if present)
        hostname = parsed_url.netloc.split(':')[0].lower()
        
        # Check against whitelist
        return hostname in TRUSTED_DOMAINS
    
    # If there's a netloc but no scheme, it might be protocol-relative URL (//example.com/path)
    # Treat this as unsafe unless explicitly allowed
    return False

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        # Here you would validate username/password
        # For demonstration purposes, assume authentication succeeds
        
        # Get the redirect target from query parameter
        return_to = request.args.get('returnTo', '/')
        
        # Validate the redirect URL
        if is_safe_redirect_url(return_to):
            return redirect(return_to)
        else:
            # If unsafe, redirect to a safe default location
            return redirect(url_for('dashboard'))
    
    # For GET requests, show login form (simplified)
    return '<form method="post"><input type="text" name="username"><button>Login</button></form>'

@app.route('/dashboard')
def dashboard():
    return 'Welcome to your dashboard!'