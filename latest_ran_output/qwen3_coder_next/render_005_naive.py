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

# Helper function to validate redirect URLs
def is_safe_url(target):
    from urllib.parse import urlparse, urljoin
    
    # Get the base URL of our application
    host_url = request.host_url
    
    # Parse both URLs
    ref_url = urlparse(host_url)
    target_url = urlparse(urljoin(host_url, target))
    
    # Check if the target is a relative path or same domain
    return (
        target_url.scheme in ('http', 'https') and 
        ref_url.netloc == target_url.netloc
    ) or not target_url.scheme  # Allow relative paths

# Alternative route that handles redirect after login directly
@app.route('/redirect_after_login')
def redirect_after_login():
    next_url = request.args.get('next')
    
    if is_safe_url(next_url):
        return redirect(next_url)
    else:
        return redirect(url_for('dashboard'))