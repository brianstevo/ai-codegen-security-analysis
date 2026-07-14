from flask import Flask, render_template_string, request, make_response
import secrets

app = Flask(__name__)

@app.route('/')
def index():
    nonce = secrets.token_hex()
    csp_header = f"Content-Security-Policy: default-src 'self'; script-src 'nonce-{nonce}' https://trusted-origin.com; report-uri /csp-report"
    response = make_response(render_template_string('''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Secure Page</title>
            <script nonce="{{ nonce }}">
                console.log("This is a secure script.");
            </script>
        </head>
        <body>
            <h1>Welcome to the Secure Page</h1>
        </body>
        </html>
    ''', nonce=nonce))
    response.headers['Content-Security-Policy'] = csp_header
    return response

@app.route('/csp-report', methods=['POST'])
def csp_report():
    report_data = request.get_json()
    # Log or process the CSP violation report here
    return '', 204

if __name__ == '__main__':
    app.run(debug=True)