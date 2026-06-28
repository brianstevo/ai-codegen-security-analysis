from flask import Flask, render_template_string, make_response
import secrets

app = Flask(__name__)

# Define trusted origins for script loading
TRUSTED_SCRIPT_ORIGINS = [
    "https://trusted-cdn.com",
    "https://trusted-api.com"
]

@app.route('/')
def secure_page():
    # Generate a cryptographically strong random nonce for this request
    nonce = secrets.token_hex(16)

    # Construct the CSP header
    # 1. default-src 'none' prevents loading any resources by default
    # 2. script-src allows only the specific nonce and trusted origins
    # 3. report-uri sends violation logs to the specified endpoint
    script_sources = [f"'nonce-{nonce}'"] + TRUSTED_SCRIPT_ORIGINS
    csp_header = (
        f"default-src 'none'; "
        f"script-src {' '.join(script_sources)}; "
        f"report-uri /csp-violation-report"
    )

    # HTML content with an inline script using the nonce
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Secure Page</title>
    </head>
    <body>
        <h1>Secure Content</h1>
        <p>This page uses a strict Content-Security-Policy.</p>
        
        <script nonce="{nonce}">
            console.log('Script executed successfully with nonce: {nonce}');
        </script>
    </body>
    </html>
    """

    response = make_response(render_template_string(html_content))
    response.headers['Content-Security-Policy'] = csp_header
    return response

@app.route('/csp-violation-report')
def csp_report():
    # Endpoint to receive CSP violation reports
    return "CSP Report Received", 200

if __name__ == '__main__':
    app.run(debug=True)