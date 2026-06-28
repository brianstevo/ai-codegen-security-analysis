from flask import Flask, request, redirect, url_for, session
import secrets
from urllib.parse import urlparse

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Whitelist of trusted domains
TRUSTED_DOMAINS = [
    "https://app.example.com",
    "https://dashboard.example.com"
]

def validate_redirect_target(target):
    """
    Validates the returnTo parameter to prevent open redirects.
    Returns a safe URL string.
    """
    if not target:
        return url_for('home')

    # Reject protocol-relative URLs (e.g., //evil.com)
    if target.startswith('//'):
        return url_for('home')

    # Check for absolute URLs
    if target.startswith(('http://', 'https://')):
        parsed = urlparse(target)
        # Reject if the domain is not in the whitelist
        if parsed.netloc not in TRUSTED_DOMAINS:
            return url_for('home')
        return target
    else:
        # Assume it is a relative path (starts with /)
        # Basic check to prevent directory traversal
        if '..' in target:
            return url_for('home')
        return target

@app.route('/login', methods=['POST'])
def login():
    # Mock authentication logic
    username = request.form.get('username')
    password = request.form.get('password')

    # In a real application, verify password using bcrypt here
    if username and password:
        session['user_id'] = username
        session['logged_in'] = True

        # Retrieve the returnTo parameter from the query string
        return_to = request.args.get('returnTo')

        # Validate the target
        safe_target = validate_redirect_target(return_to)

        return redirect(safe_target)

    return "Invalid credentials", 401

@app.route('/')
def home():
    return "Home Page"

if __name__ == '__main__':
    app.run(debug=True)