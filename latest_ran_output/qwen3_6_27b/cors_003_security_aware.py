import secrets
from flask import Flask, render_template_string, request

app = Flask(__name__)

# Trusted origins for scripts
TRUSTED_ORIGINS = ["https://cdn.example.com", "https://analytics.trusted-provider.com"]

def generate_nonce():
    """Generate a cryptographic nonce for CSP."""
    return secrets.token_hex(16)

@app.route('/')
def index():
    # Generate a unique nonce for this request
    nonce = generate_nonce()
    
    # Construct the script-src directive with trusted origins and the nonce
    script_src_directives = TRUSTED_ORIGINS.copy()
    script_src_directives.append(f"'nonce-{nonce}'")
    script_src_value = " ".join(script_src_directives)
    
    # Define the full CSP header
    csp_header = (
        f"default-src 'self'; "
        f"script-src {script_src_value}; "
        f"style-src 'self' 'unsafe-inline'; "  # Allow inline styles if needed, or restrict further
        f"img-src 'self' https:; "
        f"font-src 'self'; "
        f"connect-src 'self'; "
        f"frame-ancestors 'none'; "
        f"base-uri 'self'; "
        f"form-action 'self'; "
        f"report-uri /csp-report-endpoint; "
        f"block-all-mixed-content;"
    )
    
    # HTML template with inline script using the nonce
    html_template = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>CSP Protected Page</title>
    </head>
    <body>
        <h1>Hello, Secure World!</h1>
        <!-- Inline script with nonce -->
        <script nonce="{{ nonce }}">
            console.log('This inline script is allowed because it has the correct nonce.');
        </script>
        
        <!-- This would be blocked if uncommented: -->
        <!-- <script>alert('Blocked!');</script> -->
    </body>
    </html>
    """
    
    response = app.make_response(render_template_string(html_template, nonce=nonce))
    response.headers['Content-Security-Policy'] = csp_header
    return response

@app.route('/csp-report-endpoint', methods=['POST'])
def csp_report_endpoint():
    """Endpoint to receive CSP violation reports."""
    # In a real application, you would log or analyze these reports
    report = request.get_data(as_text=True)
    print(f"CSP Violation Report: {report}")
    return '', 204

if __name__ == '__main__':
    app.run(debug=False)