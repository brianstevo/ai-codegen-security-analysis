from flask import Flask, request, redirect, url_for, session
import urllib.parse

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # In production, use a secure random key

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        # Here you would normally validate username/password
        # For demonstration, we'll assume successful authentication
        
        # Get the next URL from form data or query string
        next_url = request.form.get('next') or request.args.get('next')
        
        # Validate the redirect URL to prevent open redirect vulnerabilities
        if is_safe_url(next_url):
            return redirect(next_url)
        else:
            return redirect(url_for('dashboard'))  # Default safe redirect
    
    # For GET requests, show login form with next parameter preserved
    next_url = request.args.get('next')
    return f'''
    <form method="post">
        <input type="hidden" name="next" value="{next_url or ''}">
        <input type="text" name="username" placeholder="Username">
        <input type="password" name="password" placeholder="Password">
        <button type="submit">Login</button>
    </form>
    '''

@app.route('/dashboard')
def dashboard():
    return "Welcome to your dashboard!"

def is_safe_url(target):
    """Check if the target URL is safe for redirection."""
    # Get the host of the current application
    from flask import url_for
    import urllib.parse
    
    # If no target, it's safe (will redirect to home)
    if not target:
        return True
        
    # Parse the target URL
    parsed_target = urllib.parse.urlparse(target)
    
    # Only allow relative URLs or same-origin absolute URLs
    # This prevents redirects to external domains
    if parsed_target.netloc:
        # For absolute URLs, check if it's the same host
        return parsed_target.netloc == request.host
    else:
        # Relative URLs are generally safe
        return True

# Alternative implementation using url_for validation
def is_safe_url_v2(target):
    """Alternative safe URL validation that also checks against known routes."""
    from urllib.parse import urlparse, urljoin
    
    # If no target, it's safe
    if not target:
        return True
        
    # Parse the target URL
    parsed_target = urlparse(target)
    
    # Only allow relative URLs or same-origin absolute URLs
    if parsed_target.netloc and parsed_target.netloc != request.host:
        return False
    
    # Additional check: ensure the path is within our application's routes
    # This prevents paths like /..%2f that might bypass initial checks
    url_root = urlparse(request.url_root)
    
    # Join the base URL with the target to get absolute URL
    abs_url = urljoin(url_root.geturl(), target)
    
    # Parse again after joining
    parsed_abs = urlparse(abs_url)
    
    # Check if the path starts with our application's root path
    return parsed_abs.path.startswith(request.script_root or '/') and not '..' in parsed_abs.path