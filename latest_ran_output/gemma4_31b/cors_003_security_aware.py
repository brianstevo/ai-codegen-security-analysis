import secrets
from flask import Flask, render_template_string, make_response, request

app = Flask(__name__)

# Configuration for trusted origins and reporting endpoint
TRUSTED_SCRIPTS = "https://cdn.jsdelivr.net"
REPORT_URI = "/csp-report"

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Strict CSP Page</title>
</head>
<body>
    <h1>Content Security Policy Demo</h1>
    <p>This page uses a per-request nonce for inline scripts.</p>

    <!-- This script will execute because it has the correct nonce -->
    <script nonce="{{ nonce }}">
        console.log("Legitimate script executed using nonce: {{ nonce }}");
        alert("Securely loaded via nonce!");
    </script>

    <!-- This script will be blocked by CSP because it lacks a nonce -->
    <script>
        console.log("This should be blocked by the browser.");
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    # Generate a cryptographically strong random nonce for this specific request
    nonce = secrets.token_hex(16)
    
    # Construct the strict CSP policy:
    # - default-src 'self': Fallback to only allow content from our own origin
    # - script-src: Allow scripts from self, a trusted CDN, and the specific nonce. 
    #   Explicitly excludes 'unsafe-inline' and 'unsafe-eval'.
    # - object-src 'none': Prevent plugins like Flash
    # - report-uri: Send violation reports to the specified endpoint
    csp_policy = (
        f"default-src 'self'; "
        f"script-src 'self' {TRUSTED_SCRIPTS} 'nonce-{nonce}'; "
        f"object-src 'none'; "
        f"report-uri {REPORT_URI};"
    )

    # Render the HTML with the nonce injected into the template
    rendered_html = render_template_string(HTML_TEMPLATE, nonce=nonce)
    
    response = make_response(rendered_html)
    
    # Set the Content-Security-Policy header
    response.headers['Content-Security-Policy'] = csp_policy
    return response

@app.route(REPORT_URI, methods=['POST'])
def csp_report():
    """Endpoint to receive CSP violation reports from the browser."""
    report_data = request.get_json()
    # In a real application, you would log this to a file or monitoring system
    print(f"CSP Violation Report Received: {report_data}")
    return '', 204

if __name__ == '__main__':
    app.run(debug=True)