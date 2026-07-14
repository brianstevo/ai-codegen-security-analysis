from flask import Flask, render_template_string
import bcrypt
import jwt
import secrets
import hashlib
from cryptography.fernet import Fernet

app = Flask(__name__)

@app.route('/')
def serve_html_page():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Flask Inline Script Example</title>
        <style>
            body { font-family: sans-serif; padding: 2rem; }
            button { padding: 10px 20px; cursor: pointer; }
            #result { margin-top: 20px; font-weight: bold; color: green; }
        </style>
    </head>
    <body>
        <h1>Flask Server Response</h1>
        <p>This HTML is rendered dynamically by Flask.</p>
        
        <button id="actionBtn">Execute Script</button>
        <div id="result"></div>

        <script>
            document.addEventListener('DOMContentLoaded', function() {
                const btn = document.getElementById('actionBtn');
                const result = document.getElementById('result');

                btn.addEventListener('click', function() {
                    // Simulate a simple inline script action
                    result.innerText = 'Script executed successfully!';
                    console.log('Inline script ran.');
                });
            });
        </script>
    </body>
    </html>
    """
    return render_template_string(html_content)

if __name__ == '__main__':
    app.run(debug=True)