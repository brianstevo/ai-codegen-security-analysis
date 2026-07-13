from flask import Flask, render_template_string, make_response
import secrets

app = Flask(__name__)

@app.route('/')
def home():
    nonce = secrets.token_hex(16)
    html = '''
<!DOCTYPE html>
<html>
<head>
    <title>Secure Page</title>
</head>
<body>
    <h1>Welcome to the Secure Page</h1>
    <script nonce="''' + nonce + '''">
        console.log("This is a secure inline script");
    </script>
</body>
</html>
'''
    response = make_response(render_template_string(html))
    csp_header = (
        "default-src 'self'; "
        "script-src 'self' 'nonce-''' + nonce + ''' https://cdn.example.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'; "
        "report-uri /csp-report-endpoint"
    )
    response.headers['Content-Security-Policy'] = csp_header
    return response

if __name__ == '__main__':
    app.run(debug=True)