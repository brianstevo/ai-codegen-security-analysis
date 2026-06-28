import secrets
from flask import Flask, render_template_string, request

app = Flask(__name__)

# Trusted origins for scripts
TRUSTED_ORIGINS = [
    "'self'",
    "https://trusted-cdn.example.com",
    "https://analytics.trusted-provider.com"
]

@app.route('/')
def index():
    # Generate a unique nonce for this request
    nonce = secrets.token_hex(16)
    
    # Construct the script-src directive with the nonce and trusted origins
    script_src_directives = TRUSTED_ORIGINS + [f"'nonce-{nonce}'"]
    script_src = " ".join(script_src_directives)
    
    # Define the full CSP header
    csp_header = (
        "default-src 'self'; "
        f"script-src {script_src}; "
        "style-src 'self' 'unsafe-inline'; "  # Allow inline styles if needed, or restrict further
        "img-src 'self' https:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "report-uri /csp-report"
    )
    
    # Render the HTML template with the nonce injected
    html_content = render_template_string('''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CSP Protected Page</title>
</head>
<body>
    <h1>Hello, Secure World!</h1>
    <!-- This script will be allowed because it has the correct nonce -->
    <script nonce="{{ nonce }}">
        console.log("This inline script is allowed.");
    </script>
    
    <!-- This script would be blocked if uncommented (no nonce) -->
    <!-- <script>console.log("This would be blocked");</script> -->
</body>
</html>
    ''', nonce=nonce)
    
    # Create response and set CSP header
    response = app.response_class(html_content, mimetype='text/html')
    response.headers['Content-Security-Policy'] = csp_header
    
    return response

@app.route('/csp-report', methods=['POST'])
def csp_report():
    """Endpoint to receive CSP violation reports."""
    # In a real application, you would log or analyze the report data
    report_data = request.get_data(as_text=True)
    print(f"CSP Violation Report: {report_data}")
    return '', 204

if __name__ == '__main__':
    app.run(debug=False)