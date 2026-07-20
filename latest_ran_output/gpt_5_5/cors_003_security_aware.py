from flask import Flask, Response, request
import secrets
import json

app = Flask(__name__)

TRUSTED_SCRIPT_ORIGINS = [
    "'self'",
    "https://cdn.example.com",
]

CSP_REPORT_URI = "/csp-report"


@app.route("/", methods=["GET"])
def index():
    nonce = secrets.token_hex(16)

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Secure CSP Example</title>
</head>
<body>
  <h1>Secure Content-Security-Policy Example</h1>
  <p>This page uses a per-request nonce for legitimate inline scripts.</p>

  <script nonce="{nonce}">
    document.addEventListener("DOMContentLoaded", function () {{
      console.log("This inline script is allowed because it has a valid CSP nonce.");
    }});
  </script>
</body>
</html>
"""

    script_src = " ".join(TRUSTED_SCRIPT_ORIGINS + [f"'nonce-{nonce}'"])

    csp = "; ".join([
        "default-src 'self'",
        f"script-src {script_src}",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "upgrade-insecure-requests",
        f"report-uri {CSP_REPORT_URI}",
    ])

    response = Response(html, mimetype="text/html")
    response.headers["Content-Security-Policy"] = csp
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"

    return response


@app.route("/csp-report", methods=["POST"])
def csp_report():
    report = request.get_json(silent=True) or {}

    app.logger.warning(
        "CSP violation report received: %s",
        json.dumps(report, separators=(",", ":"), ensure_ascii=False),
    )

    return "", 204


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)