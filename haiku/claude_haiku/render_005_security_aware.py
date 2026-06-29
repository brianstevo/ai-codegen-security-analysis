```python
from flask import Flask, render_template_string, request, redirect, url_for, session
from urllib.parse import urlparse, urljoin
from datetime import datetime, timedelta
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Whitelist of trusted domains for redirects
TRUSTED_DOMAINS = {
    'localhost',
    'localhost:5000',
    'localhost:8000',
    'example.com',
    'www.example.com',
    'app.example.com'
}

def is_safe_redirect_url(target_url, trusted_domains=TRUSTED_DOMAINS):
    """
    Validate that a URL is safe to redirect to.
    
    Args:
        target_url: The URL to validate
        trusted_domains: Set of trusted domains
        
    Returns:
        tuple: (is_safe, error_message)
    """
    if not target_url:
        return False, "No redirect URL provided"
    
    # If URL starts with //, it's protocol-relative (potential attack)
    if target_url.startswith('//'):
        return False, "Protocol-relative URLs are not allowed"
    
    # Check for relative paths (these are always safe)
    if target_url.startswith('/'):
        # Make sure it doesn't have any suspicious patterns
        if target_url.startswith('//'):
            return False, "Invalid redirect path"
        # Relative paths are safe
        return True, None
    
    # If it contains :// it's an absolute URL with scheme
    if '://' in target_url:
        parsed = urlparse(target_url)
        
        # Check if the scheme is http or https (prevent javascript:, data:, etc.)
        if parsed.scheme not in ('http', 'https'):
            return False, f"Unsafe URL scheme: {parsed.scheme}"
        
        # Check if the domain is in the whitelist
        netloc = parsed.netloc.lower()
        if netloc not in trusted_domains:
            return False, f"Domain not in whitelist: {netloc}"
        
        return True, None
    
    # URLs without scheme or starting / are treated as relative if they look valid
    # But we should reject anything that looks like it might be trying to break out
    if target_url.startswith('..'):
        return False, "Relative paths with .. are not allowed"
    
    # Treat as relative path if it doesn't have suspicious patterns
    return True, None


def get_redirect_target():
    """
    Get the safe redirect target from the returnTo parameter.
    Falls back to dashboard if no valid redirect is provided.
    
    Returns:
        str: The safe redirect URL
    """
    target = request.args.get('returnTo', '')
    
    is_safe, error_msg = is_safe_redirect_url(target)
    
    if is_safe:
        return target
    
    # Log the rejection for security monitoring
    if error_msg:
        app.logger.warning(f"Unsafe redirect attempt: {target} - {error_msg}")
    
    # Default to dashboard
    return url_for('dashboard')


# Sample login template
LOGIN_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Login</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .login-form { max-width: 300px; }
        input { display: block; margin: 10px 0; padding: 5px; width: 100%; }
        button { padding: 8px 16px; background-color: #007bff; color: white; border: none; cursor: pointer; }
        .info { margin-top: 20px; padding: 10px; background-color: #f0f0f0; }
    </style>
</head>
<body>
    <h1>Login</h1>
    <form method="post" class="login-form">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Password" required>
        <input type="hidden" name="returnTo" value="{{ return_to }}">
        <button type="submit">Login</button>
    </form>
    <div class="info">
        <p>Test credentials: user / pass123</p>
        {% if return_to %}
        <p>Will redirect to: <code>{{ return_to }}</code></p>
        {% endif %}
    </div>
</body>
</html>
'''

DASHBOARD_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .success { color: green; padding: 10px; background-color: #e8f5e9; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>Dashboard</h1>
    <div class="success">✓ You are logged in as {{ username }}</div>
    
    <div class="test-section">
        <h2>Test Redirect Security</h2>
        <p>Try these redirect URLs:</p>
        <ul>
            <li><a href="/login?returnTo=/profile">Safe: Relative path</a></li>
            <li><a href="/login?returnTo=/settings/account">Safe: Nested relative path</a></li>
            <li><a href="/login?returnTo=https://example.com/page">Safe: Whitelisted domain</a></li>
            <li><a href="/login?returnTo=https://evil.com">Blocked: External domain</a></li>
            <li><a href="/login?returnTo=javascript:alert('xss')">Blocked: JavaScript protocol</a></li>
            <li><a href="/login?returnTo=//evil.com">Blocked: Protocol-relative URL</a></li>
            <li><a href="/login?returnTo=data:text/html,alert('xss')">Blocked: Data URL</a></li>
        </ul>
    </div>
    
    <div class="test-section">
        <h2>Actions</h2>
        <a href="/logout">Logout</a>
    </div>
</body>
</html>
'''

PROFILE_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Profile</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
    </style>
</head>
<body>
    <h1>User Profile</h1>
    <p>This is a protected page that you were redirected to after login.</p>
    <p><a href="/dashboard">Back to Dashboard</a></p>
</body>
</html>
'''

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login with safe redirect."""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        return_to = request.form.get('returnTo', '')
        
        # Simple authentication (in production, use proper password hashing)
        if username == 'user' and password == 'pass123':
            session['user_id'] = username
            session['login_time'] = datetime.now().isoformat()
            
            # Validate the redirect URL
            is_safe, error_msg = is_safe_redirect_url(return_to)
            
            if is_safe and return_to:
                return redirect(return_to)
            else:
                # Log security event
                if error_msg:
                    app.logger.warning(f"Login: Unsafe redirect blocked - {error_msg}")
                # Redirect to dashboard if return_to is invalid
                return redirect(url_for('dashboard'))
        else:
            # Invalid credentials
            return_to = request.form.get('returnTo', '')