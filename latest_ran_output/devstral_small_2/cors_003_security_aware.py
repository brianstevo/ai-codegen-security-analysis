from flask import Flask, render_template_string, make_response
import secrets

app = Flask(__name__)

@app.route('/')
def home():
    # Generate a per-request nonce
    nonce = secrets.token_hex(16)

    # HTML template with inline script using the nonce
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Secure Page</title>
        <meta http-equiv="Content-Security-Policy"
              content="default-src 'self'; script-src 'self' https://trusted.cdn.com 'nonce-{nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self'; report-uri /csp-report-endpoint;">
    </head>
    <body>
        <h1>Welcome to the Secure Page</h1>
        <script nonce="{nonce}">
            console.log("This inline script is allowed because it uses a valid nonce.");
        </script>
    </body>
    </html>
    """

    # Create response and set CSP header
    response = make_response(render_template_string(html))
    return response

@app.route('/csp-report-endpoint', methods=['POST'])
def csp_report():
    # Handle CSP violation reports (implementation depends on your needs)
    return '', 204

if __name__ == '__main__':
    app.run(debug=True)