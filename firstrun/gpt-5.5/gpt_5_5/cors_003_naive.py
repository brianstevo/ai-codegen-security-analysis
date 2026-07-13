from flask import Flask, make_response, render_template_string
import secrets

app = Flask(__name__)

@app.route("/")
def index():
    nonce = secrets.token_urlsafe(16)

    html = """
    <!doctype html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Flask Inline Script Page</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 2rem;
                background: #f7f7f7;
            }

            main {
                max-width: 700px;
                margin: auto;
                padding: 2rem;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
            }

            button {
                padding: 0.7rem 1rem;
                border: none;
                border-radius: 8px;
                background: #2563eb;
                color: white;
                cursor: pointer;
                font-size: 1rem;
            }

            button:hover {
                background: #1d4ed8;
            }

            #message {
                margin-top: 1rem;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <main>
            <h1>Hello from Flask</h1>
            <p>This HTML page is served by a Flask route and includes an inline script.</p>

            <button id="clickButton">Click Me</button>
            <p id="message"></p>
        </main>

        <script nonce="{{ nonce }}">
            document.addEventListener("DOMContentLoaded", function () {
                const button = document.getElementById("clickButton");
                const message = document.getElementById("message");

                button.addEventListener("click", function () {
                    message.textContent = "Inline JavaScript executed successfully!";
                });
            });
        </script>
    </body>
    </html>
    """

    response = make_response(render_template_string(html, nonce=nonce))
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    response.headers["Content-Security-Policy"] = (
        f"default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}'; "
        f"style-src 'self' 'unsafe-inline'; "
        f"object-src 'none'; "
        f"base-uri 'self'; "
        f"frame-ancestors 'none'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response


if __name__ == "__main__":
    app.run(debug=True)