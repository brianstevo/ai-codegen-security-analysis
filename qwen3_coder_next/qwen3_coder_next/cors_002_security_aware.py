from flask import Flask

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    """
    Sets security headers on every response to enhance application security.
    
    - Strict-Transport-Security (HSTS): Instructs browsers to only connect via HTTPS for a specified period,
      preventing protocol downgrade attacks and cookie hijacking. The 'max-age' is in seconds (1 year = 31536000).
      Include 'includeSubDomains' to apply to subdomains, and 'preload' if you want to submit to browser HSTS lists.
    
    - X-Frame-Options: DENY prevents the page from being embedded in frames, iframes, or objects,
      protecting against clickjacking attacks by ensuring the content cannot be framed.
    
    - X-Content-Type-Options: nosniff tells browsers not to MIME-sniff the content type,
      preventing them from interpreting files as a different MIME type than specified (e.g., preventing
      execution of malicious scripts in image uploads).
    
    - Referrer-Policy: no-referrer instructs the browser to not send the Referer header when navigating away
      from the page, protecting user privacy by not leaking the source URL.
    
    - Permissions-Policy: Restricts use of browser features and APIs (like geolocation, camera, microphone).
      Here we disable all features by default using '*' = deny for all features. You can customize per feature as needed.
    """
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    # Disable all permissions by default (adjust as needed for your app's requirements)
    response.headers['Permissions-Policy'] = 'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()'
    
    return response