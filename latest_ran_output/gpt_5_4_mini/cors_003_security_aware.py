from flask import Flask, Response, render_template_string, request
import secrets

app = Flask(__name__)

TRUSTED_SCRIPT_ORIGINS = [
    "https://cdn.example.com",
    "https://static.example.com",
]

HTML_TEMPLATE = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Strict CSP Page</title>
</head>
<body>
  <h1>Strict CSP Protected Page</h1>
  <p>If JavaScript is enabled, the inline script below is authorized by a per-request nonce.</p>

  <script nonce="{{ csp_nonce }}">
    (function () {
      console.log("Nonce-authorized inline script executed.");
    })();
  </script>
</body>
</html>
"""

@app.route("/")
def index():
    csp_nonce = secrets.token_hex(16)

    csp_directives = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "style-src 'self'",
        f"script-src 'self' 'nonce-{csp_nonce}' " + " ".join(TRUSTED_SCRIPT_ORIGINS),
        "connect-src 'self'",
        "font-src 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
        "block-all-mixed-content",
        "report-uri /csp-report",
    ]

    html = render_template_string(HTML_TEMPLATE, csp_nonce=csp_nonce)
    response = Response(html, mimetype="text/html")
    response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
    return response

@app.route("/csp-report", methods=["POST"])
def csp_report():
    # In a real application, validate and log the incoming CSP violation report securely.
    return ("", 204)

if __name__ == "__main__":
    app.run(debug=True)