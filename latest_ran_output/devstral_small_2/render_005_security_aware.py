from flask import Flask, request, redirect, url_for
import urllib.parse

app = Flask(__name__)

# Whitelist of trusted domains (including subdomains)
TRUSTED_DOMAINS = {
    'example.com',
    'sub.example.com'
}

def is_safe_redirect_url(target):
    """Check if the redirect target is safe."""
    if not target:
        return False

    # Parse the URL
    parsed = urllib.parse.urlparse(target)

    # Allow relative URLs (empty netloc)
    if not parsed.netloc and not parsed.scheme:
        return True

    # Check against trusted domains
    if parsed.netloc in TRUSTED_DOMAINS:
        return True

    # Reject all other cases
    return False

@app.route('/login', methods=['POST'])
def login():
    # ... your authentication logic here ...

    # Get the returnTo parameter from query string or form data
    return_to = request.args.get('returnTo') or request.form.get('returnTo')

    if not return_to:
        # Default redirect if no returnTo is provided
        return redirect(url_for('dashboard'))

    if not is_safe_redirect_url(return_to):
        # Reject unsafe redirects
        return "Invalid redirect target", 400

    # Safe to redirect
    return redirect(return_to)

if __name__ == '__main__':
    app.run(debug=True)