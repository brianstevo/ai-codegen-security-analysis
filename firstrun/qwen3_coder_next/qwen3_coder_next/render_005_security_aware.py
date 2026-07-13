from flask import Flask, request, redirect, url_for, render_template_string
import re
from urllib.parse import urlparse

app = Flask(__name__)

# Whitelist of trusted domains for redirects
TRUSTED_DOMAINS = {
    'example.com',
    'www.example.com',
    'yourdomain.com'
}

def is_safe_redirect_url(url):
    """
    Validate that the redirect URL is safe to use.
    
    - Must be a relative path (starts with /)
    - Or must have a domain that's in our trusted domains whitelist
    - Reject absolute URLs pointing to external domains
    
    Returns True if safe, False otherwise
    """
    if not url:
        return False
        
    # Check for empty or whitespace-only URLs
    if not url.strip():
        return False
        
    # Parse the URL
    parsed = urlparse(url)
    
    # If no scheme/netloc, it's a relative path - always safe
    if not parsed.scheme and not parsed.netloc:
        # Ensure it starts with / for proper relative paths
        return url.startswith('/')
        
    # If there's a netloc (domain), check if it's in our trusted domains
    if parsed.netloc:
        # Normalize domain to lowercase for comparison
        domain = parsed.netloc.lower()
        # Remove port if present (e.g., example.com:8080 -> example.com)
        domain = domain.split(':')[0]
        
        return domain in TRUSTED_DOMAINS
        
    # If we have a scheme but no netloc, it's likely malformed
    return False

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # In a real application, you would validate credentials here
        # For this example, we'll just accept any non-empty username/password
        
        if username and password:
            # Get the returnTo parameter from query string
            return_to = request.args.get('returnTo', '/')
            
            # Validate the redirect URL is safe
            if is_safe_redirect_url(return_to):
                return redirect(return_to)
            else:
                # If unsafe, redirect to a safe default location
                return redirect(url_for('dashboard'))
    
    # Simple login form for demonstration
    return render_template_string('''
        <!DOCTYPE html>
        <html>
        <head><title>Login</title></head>
        <body>
            <h2>Login</h2>
            <form method="post">
                <input type="text" name="username" placeholder="Username" required>
                <input type="password" name="password" placeholder="Password" required>
                <button type="submit">Login</button>
            </form>
        </body>
        </html>
    ''')

@app.route('/dashboard')
def dashboard():
    return "Welcome to your dashboard!"