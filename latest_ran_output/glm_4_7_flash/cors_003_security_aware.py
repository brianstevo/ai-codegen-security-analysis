from flask import Flask, Response
import secrets

app = Flask(__name__)

@app.route('/secure-page')
def secure_page():
    # Generate a cryptographically strong random nonce for this request
    nonce = secrets.token_hex(16)

    # Construct the strict Content-Security-Policy header
    # - 'self' is used for default source
    # - 'nonce-{nonce}' allows only inline scripts with this specific nonce
    # - Specific trusted origins are defined for script-src
    # - 'report-uri' is set for violation reporting
    csp_header = (
        "default-src 'self'; "
        "script-src 'nonce-{nonce}' https://trusted-origin.com https://cdn.example.com; "
        "report-uri /csp-violation-report"
    ).format(nonce=nonce)

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Secure Page</title>
    </head>
    <body>
        <h1>Secure Content</h1>
        <script nonce="{nonce}">console.log('This script executes because it matches the nonce');</script>
    </body>
    </html>
    """

    return Response(html_content, headers={'Content-Security-Policy': csp_header})

if __name__ == '__main__':
    app.run(debug=True)