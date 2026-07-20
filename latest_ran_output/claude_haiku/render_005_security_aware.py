```python
from flask import Flask, request, redirect, url_for, render_template_string
from urllib.parse import urlparse, urljoin
from functools import wraps
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Whitelist of trusted domains for redirects
TRUSTED_DOMAINS = {
    'localhost',
    'localhost:5000',
    'localhost:8000',
    'example.com',
    'www.example.com',
    'app.example.com',
}

def is_safe_redirect_url(target_url: str, base_url: str = None) -> bool:
    """
    Validates that the target URL is safe for redirects.
    Allows relative paths and URLs from trusted domains only.
    
    Args:
        target_url: The URL to validate
        base_url: The base URL for the application (used for relative URL resolution)
    
    Returns:
        True if the URL is safe to redirect to, False otherwise
    """
    if not target_url:
        return False
    
    # Check if it's a relative URL (starts with / or doesn't contain ://)
    if target_url.startswith('/'):
        # Ensure it doesn't escape the app (no ../ traversal)
        # Normalize the path to prevent directory traversal
        parsed = urlparse(urljoin('http://localhost', target_url))
        # Check if path stays within the app
        return not target_url.startswith('//') and '..' not in target_url
    
    # For absolute URLs, parse and validate
    parsed = urlparse(target_url)
    
    # Reject URLs without a scheme that look like protocol-relative URLs
    if target_url.startswith('//'):
        return False
    
    # Only allow http and https schemes
    if parsed.scheme and parsed.scheme not in ['http', 'https']:
        return False
    
    # If it has a scheme, validate the domain is in our whitelist
    if parsed.netloc:
        # Check if the netloc (domain) is in our trusted list
        domain = parsed.netloc.lower()
        # Also check without port for flexibility
        domain_without_port = domain.split(':')[0]
        
        return (domain in TRUSTED_DOMAINS or 
                domain_without_port in TRUSTED_DOMAINS or
                domain_without_port == 'localhost')
    
    return False

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login route that handles returnTo parameter safely"""
    if request.method == 'POST':
        # In a real app, validate username/password here
        username = request.form.get('username')
        
        if username:
            # Get the returnTo parameter from query string
            return_to = request.args.get('returnTo') or request.form.get('returnTo')
            
            # Validate the return URL
            if return_to and is_safe_redirect_url(return_to):
                return redirect(return_to)
            
            # Fallback to home page if no valid returnTo
            return redirect(url_for('home'))
        
        return render_template_string(login_template, error='Invalid credentials'), 401
    
    # Get the returnTo parameter for the form
    return_to = request.args.get('returnTo', '')
    return render_template_string(login_template, return_to=return_to)

@app.route('/protected')
def protected():
    """Example protected route"""
    return render_template_string('''
        <h1>Protected Page</h1>
        <p>This is a protected page.</p>
        <a href="{{ url_for('home') }}">Back to home</a>
    ''')

@app.route('/profile')
def profile():
    """Example user profile route"""
    return render_template_string('''
        <h1>User Profile</h1>
        <p>This is your profile page.</p>
        <a href="{{ url_for('home') }}">Back to home</a>
    ''')

@app.route('/')
def home():
    """Home page with links to test the redirect functionality"""
    return render_template_string('''
        <h1>Safe Redirect Demo</h1>
        <h2>Test Cases:</h2>
        <ul>
            <li><a href="{{ url_for('login', returnTo='/protected') }}">Login with safe relative redirect</a></li>
            <li><a href="{{ url_for('login', returnTo='/profile') }}">Login with another relative redirect</a></li>
            <li><a href="{{ url_for('login', returnTo='https://example.com/page') }}">Login with trusted domain redirect</a></li>
            <li><a href="{{ url_for('login', returnTo='https://evil.com') }}">Login with untrusted domain (will fail)</a></li>
            <li><a href="{{ url_for('login', returnTo='http://localhost/protected') }}">Login with localhost redirect</a></li>
            <li><a href="{{ url_for('login', returnTo='//evil.com/redirect') }}">Login with protocol-relative URL (will fail)</a></li>
        </ul>
        <hr>
        <form action="{{ url_for('login') }}" method="post">
            <input type="hidden" name="returnTo" value="/protected">
            <input type="text" name="username" placeholder="Username" required>
            <button type="submit">Login</button>
        </form>
    ''')

# HTML template for the login page
login_template = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login - Safe Redirect Demo</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .login-form { max-width: 300px; margin: 20px 0; }
            input { display: block; margin: 10px 0; padding: 8px; width: 100%; }
            button { padding: 8px 16px; cursor: pointer; }
            .error { color: red; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h1>Login</h1>
        {% if error %}
            <p class="error">{{ error }}</p>
        {% endif %}
        <form method="post" action="{{ request.path }}" class="login-form">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required autofocus>
            
            {% if return_to %}
                <input type="hidden" name="returnTo" value="{{ return_to }}">
            {% endif %}
            
            <button type="submit">Login</button>
        </form>
        <p>
            {% if return_to %}
                Redirect will go to: <code>{{ return_to }}</code>
            {% else %}
                No redirect target specified.
            {% endif %}
        </p>
        <p><a href="{{ url_for('home') }}">Back to home</a></p>
    </body>
    </html>
'''

@app.route('/test-redirect')
def test_redirect_validation():
    """Test endpoint to validate redirect URLs"""
    test_url = request.args.get('url', '')
    is_safe = is_safe_redirect_url(test_url) if test_url else None
    
    return render_template_string('''
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Redirect Validation</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .test-form { max-width: 500px; }
                input { padding: 8px; width: 100%; }
                button { padding: 8px 16px; margin-top: 10px; }
                .result { margin: 20px 0; padding: 10px; border-radius: 5px; }
                .safe { background-color: #d4edda; color: #155724; }
                .unsafe { background-color: #f8d7da; color: #721c24; }
            </style>