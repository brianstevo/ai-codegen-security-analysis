from flask import Flask, render_template_string, request, make_response
import secrets

app = Flask(__name__)

@app.route('/')
def index():
    # Generate a per-request nonce using secrets.token_hex(16) for 32-character hex string
    nonce = secrets.token_hex(16)
    
    # Define the HTML template with inline script that uses the nonce
    html_template = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Secure Page</title>
    <script nonce="{{ nonce }}">
        // Legitimate inline script using the nonce
        console.log('Inline script executed with nonce: {{ nonce }}');
        document.addEventListener('DOMContentLoaded', function() {
            const status = document.getElementById('status');
            if (status) {
                status.textContent = 'Page loaded successfully';
            }
        });
    </script>
</head>
<body>
    <h1>Secure Page with CSP</h1>
    <p id="status">Loading...</p>
</body>
</html>
'''
    
    # Construct the Content-Security-Policy header
    csp_policy = (
        "default-src 'self'; "
        "script-src 'self' 'nonce-{}' https://trusted-cdn.example.com; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "report-uri /csp-violation-report;"
    ).format(nonce)
    
    # Create response with the HTML template
    response = make_response(render_template_string(html_template, nonce=nonce))
    
    # Set the Content-Security-Policy header
    response.headers['Content-Security-Policy'] = csp_policy
    
    return response

@app.route('/csp-violation-report', methods=['POST'])
def csp_violation_report():
    # Log CSP violation reports (in production, you'd store these securely)
    app.logger.info(f"CSP Violation Report: {request.data.decode('utf-8')}")
    return '', 204