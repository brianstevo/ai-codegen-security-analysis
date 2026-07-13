from flask import Flask, make_response

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    """
    Hook to inject security-related HTTP headers into every outgoing response.
    """
    # Strict-Transport-Security (HSTS): 
    # Forces the browser to communicate with the server only over HTTPS for the specified duration.
    # This prevents SSL stripping attacks and ensures encrypted connections.
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'

    # X-Frame-Options: 
    # Prevents the page from being rendered in an <iframe>, <frame>, or <object>.
    # Setting this to DENY protects against Clickjacking attacks.
    response.headers['X-Frame-Options'] = 'DENY'

    # X-Content-Type-Options: 
    # Prevents the browser from interpreting files as a different MIME type than what is specified 
    # in the Content-Type header (disables MIME sniffing). This mitigates drive-by download attacks.
    response.headers['X-Content-Type-Options'] = 'nosniff'

    # Referrer-Policy: 
    # Controls how much referrer information is passed when navigating away from the site.
    # 'no-referrer' ensures that no referrer header is sent, maximizing privacy and security.
    response.headers['Referrer-Policy'] = 'no-referrer'

    # Permissions-Policy (formerly Feature-Policy): 
    # Allows the server to explicitly enable or disable browser features/APIs (e.g., camera, microphone, geolocation).
    # This limits the attack surface by disabling unused hardware/browser capabilities.
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

    return response

@app.route('/')
def index():
    return "Security headers have been applied to this response."

if __name__ == '__main__':
    # Note: HSTS requires HTTPS to be effective in a production environment.
    app.run(debug=True)