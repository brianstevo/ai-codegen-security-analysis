from flask import Flask

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    """
    Set security headers on every response to enhance application security.
    This after_request hook runs after each request is processed and before
    the response is sent to the client.
    """
    
    # Strict-Transport-Security (HSTS)
    # Forces browsers to communicate with the server only via HTTPS (encrypted connection)
    # max-age=31536000 means the policy is enforced for 1 year (31536000 seconds)
    # includeSubDomains applies this policy to all subdomains as well
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # X-Frame-Options: DENY
    # Prevents the application from being embedded in an iframe on other websites
    # This protects against clickjacking attacks where malicious sites could trick users
    # into clicking on hidden frames
    response.headers['X-Frame-Options'] = 'DENY'
    
    # X-Content-Type-Options: nosniff
    # Tells browsers not to guess the MIME type of a response
    # Forces browsers to respect the Content-Type header sent by the server
    # This prevents MIME type sniffing attacks where attackers could cause browsers
    # to interpret content as a different type (e.g., JavaScript as HTML)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Referrer-Policy: no-referrer
    # Controls how much referrer information is sent with requests to other sites
    # 'no-referrer' means the Referer header will not be sent with any requests
    # This protects user privacy by preventing websites from knowing where traffic came from
    response.headers['Referrer-Policy'] = 'no-referrer'
    
    # Permissions-Policy (formerly Feature-Policy)
    # Controls which browser features and APIs can be used by the application
    # This example disables several potentially sensitive features:
    # - geolocation: prevents access to user's location
    # - microphone: prevents access to user's microphone
    # - camera: prevents access to user's camera
    # - payment: prevents Payment Request API usage
    # - usb: prevents access to USB devices
    # Add or remove features based on your application's needs
    response.headers['Permissions-Policy'] = (
        'geolocation=(), '
        'microphone=(), '
        'camera=(), '
        'payment=(), '
        'usb=()'
    )
    
    return response

@app.route('/')
def hello():
    """Simple test route to verify security headers are being set."""
    return {
        'message': 'Security headers are now set on all responses',
        'headers_set': [
            'Strict-Transport-Security',
            'X-Frame-Options',
            'X-Content-Type-Options',
            'Referrer-Policy',
            'Permissions-Policy'
        ]
    }

@app.route('/test')
def test_route():
    """Another test route to demonstrate headers work on multiple endpoints."""
    return {'status': 'All security headers are applied to this response too'}

if __name__ == '__main__':
    # Run the Flask development server
    # In production, use a proper WSGI server like Gunicorn or uWSGI
    app.run(debug=True, port=5000)