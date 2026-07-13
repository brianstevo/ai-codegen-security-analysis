from flask import Flask, Response, render_template_string
import secrets

app = Flask(__name__)


# A page template with inline scripts. We use a per-request nonce so the
# Content-Security-Policy can allow our own inline scripts without resorting
# to the insecure 'unsafe-inline' directive.
PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Inline Script Demo</title>
    <script nonce="{{ nonce }}">
        // Inline script #1: runs as soon as it is parsed.
        window.APP_CONFIG = {
            version: "1.0.0",
            loadedAt: new Date().toISOString()
        };
        console.log("APP_CONFIG initialized", window.APP_CONFIG);
    </script>
</head>
<body>
    <h1>Inline Script Demo</h1>
    <p id="status">Waiting for DOM...</p>
    <button id="action-btn" type="button">Click me</button>

    <script nonce="{{ nonce }}">
        // Inline script #2: wire up DOM behaviour after content loads.
        document.addEventListener("DOMContentLoaded", function () {
            var status = document.getElementById("status");
            var btn = document.getElementById("action-btn");

            status.textContent = "DOM ready (v" + window.APP_CONFIG.version + ")";

            var clicks = 0;
            btn.addEventListener("click", function () {
                clicks += 1;
                status.textContent = "Button clicked " + clicks + " time(s)";
            });
        });
    </script>
</body>
</html>
"""


@app.route("/", methods=["GET"])
def index():
    # Generate a cryptographically strong nonce for this response.
    nonce = secrets.token_urlsafe(16)

    html = render_template_string(PAGE_TEMPLATE, nonce=nonce)
    response = Response(html, mimetype="text/html")

    # Restrict resource loading and only permit inline scripts carrying our nonce.
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}'; "
        "style-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"

    return response


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)