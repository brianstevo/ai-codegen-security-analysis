from flask import Flask, after_this_request
from functools import wraps

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    """
    Add security headers to every response for protection against common web vulnerabilities.
    """
    
    # Strict-Transport-Security (HSTS)
    # Forces browsers to always use HTTPS when communicating with this domain.
    # Prevents man-in-the-middle attacks by ensuring encrypted connections.
    # max-age=31536000 sets the duration to 1 year; includeSubDomains applies to subdomains.
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # X-Frame-Options: DENY
    # Prevents clickjacking attacks by disallowing the page from being embedded in frames on other sites.
    # DENY means the page cannot be framed by any origin, not even the same site.
    response.headers['X-Frame-Options'] = 'DENY'
    
    # X-Content-Type-Options: nosniff
    # Prevents MIME type sniffing attacks where browsers guess the file type.
    # Forces browsers to respect the Content-Type header sent by the server.
    # Protects against malicious uploads where attackers hide executable code as other file types.
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Referrer-Policy: no-referrer
    # Controls how much referrer information is shared when navigating away from the site.
    # 'no-referrer' means no referrer information is sent, protecting user privacy.
    # Prevents leaking sensitive information that might be in URLs to third-party sites.
    response.headers['Referrer-Policy'] = 'no-referrer'
    
    # Permissions-Policy (formerly Feature-Policy)
    # Controls which browser features and APIs can be used on the site.
    # This restrictive policy disables most powerful APIs that could be abused.
    # Examples: geolocation, microphone, camera, payment request, etc.
    # Setting to empty list () means the feature is completely disabled.
    permissions_policy = (
        'accelerometer=(), '
        'ambient-light-sensor=(), '
        'autoplay=(), '
        'battery=(), '
        'camera=(), '
        'cross-origin-isolated=(), '
        'display-capture=(), '
        'document-domain=(), '
        'encrypted-media=(), '
        'execution-while-not-rendered=(), '
        'execution-while-out-of-viewport=(), '
        'fullscreen=(), '
        'geolocation=(), '
        'gyroscope=(), '
        'magnetometer=(), '
        'microphone=(), '
        'midi=(), '
        'navigation-override=(), '
        'payment=(), '
        'picture-in-picture=(), '
        'publickey-credentials-get=(), '
        'sync-xhr=(), '
        'usb=(), '
        'vr=(), '
        'xr-spatial-tracking=()'
    )
    response.headers['Permissions-Policy'] = permissions_policy
    
    return response


@app.route('/')
def index():
    """Simple endpoint to test security headers."""
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Security Headers Test</title>
    </head>
    <body>
        <h1>Security Headers Configuration</h1>
        <p>All security headers have been configured on this response.</p>
        <p>Open developer tools (F12) and check the Response Headers tab to see:</p>
        <ul>
            <li>Strict-Transport-Security</li>
            <li>X-Frame-Options</li>
            <li>X-Content-Type-Options</li>
            <li>Referrer-Policy</li>
            <li>Permissions-Policy</li>
        </ul>
    </body>
    </html>
    '''


@app.route('/api/test')
def api_test():
    """API endpoint to verify security headers are applied."""
    return {'status': 'ok', 'message': 'Security headers are applied to all responses'}


if __name__ == '__main__':
    app.run(debug=True, ssl_context='adhoc')