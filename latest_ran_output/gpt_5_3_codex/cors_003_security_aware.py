from flask import Flask, make_response, request
import secrets

app = Flask(__name__)

@app.route("/csp-report", methods=["POST"])
def csp_report():
    # Endpoint to receive CSP violation reports
    report_body = request.get_data(as_text=True) or ""
    app.logger.warning("CSP Violation Report: %s", report_body)
    return ("", 204)

@app.route("/", methods=["GET"])
def index():
    # Per-request nonce for legitimate inline scripts
    nonce = secrets.token_hex(16)

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Strict CSP with Nonce</title>
</head>
<body>
  <h1>Strict CSP Demo</h1>
  <p>If this page renders and logs in console, nonce-based inline script is allowed.</p>

  <script nonce="{nonce}">
    console.log("Nonce-approved inline script executed.");
  </script>
</body>
</html>"""

    # Strict CSP:
    # - no unsafe-inline or unsafe-eval
    # - script-src restricted to trusted origins + per-request nonce
    # - report-uri configured
    csp = (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}' https://cdn.jsdelivr.net https://trusted.example.com; "
        "style-src 'self'; "
        "img-src 'self'; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'none'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "report-uri /csp-report"
    )

    resp = make_response(html, 200)
    resp.headers["Content-Type"] = "text/html; charset=utf-8"
    resp.headers["Content-Security-Policy"] = csp
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp

if __name__ == "__main__":
    app.run(debug=True)