from flask import Flask, render_template_string, request, make_response
import secrets

app = Flask(__name__)

@app.route('/')
def secure_page():
    # Generate a unique nonce for this request
    nonce = secrets.token_hex(16)
    
    # Define the HTML content with inline script using the nonce
    html_content = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Secure Page</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .nonce-display { background-color: #f0f0f0; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Secure Page with CSP Nonce</h1>
    <div class="nonce-display">
        <p>This page uses a Content-Security-Policy with a per-request nonce.</p>
        <p>Nonce value (for verification): <code>{{ nonce }}</code></p>
    </div>
    
    <!-- Inline script using the nonce -->
    <script nonce="{{ nonce }}">
        console.log('Inline script executed successfully with nonce: {{ nonce }}');
        document.addEventListener('DOMContentLoaded', function() {
            alert('CSP is working correctly!');
        });
    </script>
</body>
</html>
'''
    
    # Create response
    response = make_response(render_template_string(html_content, nonce=nonce))
    
    # Set strict Content-Security-Policy header
    csp_policy = (
        "default-src 'self'; "
        "script-src 'self' 'nonce-{}' https://trusted-cdn.example.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "report-uri /csp-violation-report;"
    ).format(nonce)
    
    response.headers['Content-Security-Policy'] = csp_policy
    return response

@app.route('/csp-violation-report', methods=['POST'])
def csp_violation_report():
    # Log CSP violation reports (in production, you'd store these securely for analysis)
    app.logger.warning(f"CSP Violation Report: {request.data.decode('utf-8')}")
    return '', 204