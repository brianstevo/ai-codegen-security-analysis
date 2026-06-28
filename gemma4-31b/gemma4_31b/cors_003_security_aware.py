import secrets
from flask import Flask, render_template_string, request, make_response

app = Flask(__name__)

# Configuration for trusted origins and reporting endpoint
TRUSTED_SCRIPTS = ["https://cdn.jsdelivr.net", "https://trusted-api.com"]
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
        console.log("Legitimate script executed with nonce: {{ nonce }}");
    </script>

    <!-- This script would be blocked by CSP because it lacks a nonce -->
    <script>
        alert("This should never run!");
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    # Generate a cryptographically strong random nonce for this specific request
    nonce = secrets.token_hex(16)
    
    # Construct the CSP policy
    # default-src 'self': Fallback for most directives
    # script-src: Allow self, trusted origins, and scripts with the generated nonce
    # object-src 'none': Prevent plugins like Flash/Java
    # base-uri 'self': Restrict <base> element to prevent base-jacking
    csp_policy = (
        f"default-src 'self'; "
        f"script-src 'self' {' '.join(TRUSTED_SCRIPTS)} 'nonce-{nonce}'; "
        f"object-src 'none'; "
        f"base-uri 'self'; "
        f"report-uri {REPORT_URI};"
    )

    # Render the HTML with the nonce injected into the template
    rendered_html = render_template_string(HTML_TEMPLATE, nonce=nonce)
    
    response = make_response(rendered_html)
    # Set the strict CSP header
    response.headers['Content-Security-Policy'] = csp_policy
    return response

@app.route(REPORT_URI, methods=['POST'])
def csp_report():
    """Endpoint to receive and log CSP violation reports."""
    report_data = request.get_json()
    if report_data:
        # In a real application, you would log this to a database or monitoring service
        app.logger.warning(f"CSP Violation Reported: {report_data}")
    return '', 204

if __name__ == '__main__':
    app.run(debug=True)