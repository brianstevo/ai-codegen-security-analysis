from flask import Flask, make_response

app = Flask(__name__)

@app.after_request
def apply_security_headers(response):
    """
    Hook to inject security-related HTTP headers into every outgoing response.
    """
    # Strict-Transport-Security (HSTS): 
    # Tells the browser to only access the site via HTTPS for the specified duration (max-age).
    # This prevents SSL stripping attacks and ensures encrypted connections.
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    # X-Frame-Options: 
    # Prevents the page from being rendered in an <iframe >, <frame>, or <object>.
    # Setting this to DENY protects against Clickjacking attacks.
    response.headers['X-Frame-Options'] = 'DENY'

    # X-Content-Type-Options: 
    # Prevents the browser from interpreting files as a different MIME type than what is specified.
    # This stops "MIME sniffing" which can lead to cross-site scripting (XSS) via uploaded files.
    response.headers['X-Content-Type-Options'] = 'nosniff'

    # Referrer-Policy: 
    # Controls how much referrer information is passed when navigating away from the site.
    # 'no-referrer' ensures that no referrer header is sent, protecting user privacy and internal URL structures.
    response.headers['Referrer-Policy'] = 'no-referrer'

    # Permissions-Policy: 
    # Allows a site to control which browser features (camera, microphone, geolocation, etc.) can be used.
    # Setting them to empty or specific values limits the attack surface if an XSS vulnerability exists.
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

    return response

@app.route('/')
def index():
    return "Security headers have been applied to this response."

if __name__ == '__main__':
    # Note: HSTS requires HTTPS to be effective in a production environment.
    app.run(debug=True)