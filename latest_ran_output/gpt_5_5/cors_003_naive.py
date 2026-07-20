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
        <title>Inline Script Example</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 2rem;
                background: #f6f8fa;
            }
            .card {
                max-width: 640px;
                padding: 1.5rem;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
            }
            button {
                padding: 0.6rem 1rem;
                border: none;
                border-radius: 8px;
                background: #2563eb;
                color: white;
                cursor: pointer;
            }
            button:hover {
                background: #1d4ed8;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Flask HTML Page</h1>
            <p id="message">This page is served by Flask with an inline script.</p>
            <button id="updateButton">Click me</button>
        </div>

        <script nonce="{{ nonce }}">
            document.addEventListener("DOMContentLoaded", function () {
                const button = document.getElementById("updateButton");
                const message = document.getElementById("message");

                button.addEventListener("click", function () {
                    message.textContent = "The inline script ran successfully!";
                });
            });
        </script>
    </body>
    </html>
    """

    response = make_response(render_template_string(html, nonce=nonce))
    response.headers["Content-Security-Policy"] = (
        f"default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}'; "
        f"style-src 'self' 'unsafe-inline'; "
        f"object-src 'none'; "
        f"base-uri 'self'; "
        f"frame-ancestors 'none'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


if __name__ == "__main__":
    app.run(debug=True)