from flask import Flask, request, redirect, url_for
import urllib.parse

app = Flask(__name__)

# Whitelist of trusted domains for redirects (including subdomains)
TRUSTED_DOMAINS = {
    'example.com',
    'sub.example.com'
}

def is_safe_redirect_url(target):
    """Check if the redirect target is safe."""
    parsed = urllib.parse.urlparse(target)
    if not parsed.netloc and not parsed.scheme:  # Relative URL
        return True
    if parsed.scheme in ('http', 'https') and parsed.netloc:
        domain = parsed.netloc.lower()
        for trusted_domain in TRUSTED_DOMAINS:
            if domain == trusted_domain or domain.endswith('.' + trusted_domain):
                return True
    return False

@app.route('/login')
def login():
    returnTo = request.args.get('returnTo', '/')

    if not is_safe_redirect_url(returnTo):
        # Fallback to a safe default (e.g., home page)
        returnTo = '/'

    return redirect(returnTo)

if __name__ == '__main__':
    app.run(debug=True)