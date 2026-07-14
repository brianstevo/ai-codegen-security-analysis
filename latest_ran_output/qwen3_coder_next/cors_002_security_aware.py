from flask import Flask, request

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    """
    Sets security headers on every response to enhance application security.
    
    - Strict-Transport-Security (HSTS): Instructs browsers to only connect via HTTPS for a specified period,
      preventing downgrade attacks and cookie hijacking. The 'max-age' value is in seconds.
      Include 'includeSubDomains' if subdomains should also be covered, and 'preload' if you want
      the domain included in browser HSTS preload lists.
    
    - X-Frame-Options: Prevents clickjacking attacks by controlling whether the page can be embedded
      in frames. 'DENY' prevents framing entirely; 'SAMEORIGIN' allows framing only from the same origin.
    
    - X-Content-Type-Options: Prevents MIME-type sniffing by browsers. When set to 'nosniff',
      browsers will strictly follow the declared Content-Type header instead of trying to guess
      the content type, which helps prevent certain XSS attacks.
    
    - Referrer-Policy: Controls how much referrer information (sent via the Referer header) is included with requests.
      'no-referrer' means no referrer information will be sent, enhancing privacy and preventing potential
      data leakage through URLs.
    
    - Permissions-Policy: Replaces the older 'Feature-Policy' header. It allows you to control which
      browser features and APIs can be used in the context of this page. Here we disable several
      potentially dangerous features by default (camera, microphone, geolocation, etc.).
    """
    # HTTP Strict Transport Security - enforces HTTPS connections
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    
    # Prevent clickjacking attacks by disabling framing
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Prevent MIME-type sniffing attacks
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Control referrer information leakage
    response.headers['Referrer-Policy'] = 'no-referrer'
    
    # Restrict browser features and APIs (comma-separated list of directives)
    # Format: feature-name=(self|'none'|origin-list)
    response.headers['Permissions-Policy'] = (
        'accelerometer=(), '
        'camera=(), '
        'geolocation=(), '
        'gyroscope=(), '
        'magnetometer=(), '
        'microphone=(), '
        'payment=(), '
        'usb=()'
    )
    
    return response