import json
import logging
import secrets

from flask import Flask, Response, abort, request

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)


@app.get("/")
def index():
    nonce = secrets.token_hex(16)

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Strict CSP Example</title>
</head>
<body>
  <main>
    <h1>Strict Content-Security-Policy Example</h1>
    <p>This page allows only trusted scripts and a per-request nonce for legitimate inline JavaScript.</p>
  </main>

  <script nonce="{nonce}">
    document.addEventListener("DOMContentLoaded", () => {{
      console.log("Legitimate inline script executed with a valid CSP nonce.");
    }});
  </script>
</body>
</html>
"""

    trusted_script_origins = [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
    ]

    csp = "; ".join(
        [
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "img-src 'self'",
            "style-src 'self'",
            "font-src 'self'",
            "connect-src 'self'",
            f"script-src {' '.join(trusted_script_origins)} 'nonce-{nonce}'",
            "upgrade-insecure-requests",
            "report-uri /csp-report",
        ]
    )

    response = Response(html, mimetype="text/html; charset=utf-8")
    response.headers["Content-Security-Policy"] = csp
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.post("/csp-report")
def csp_report():
    if not request.data:
        abort(400)

    try:
        payload = request.get_json(force=True, silent=False)
    except Exception:
        abort(400)

    app.logger.warning("CSP violation report: %s", json.dumps(payload, separators=(",", ":")))
    return "", 204


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)