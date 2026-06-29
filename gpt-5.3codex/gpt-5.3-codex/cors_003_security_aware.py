from flask import Flask, make_response, request, jsonify
import secrets
import html

app = Flask(__name__)

# Trusted script origins (adjust to your environment)
TRUSTED_SCRIPT_ORIGINS = [
    "https://cdn.jsdelivr.net",
    "https://www.googletagmanager.com",
]

@app.route("/")
def index():
    # Per-request nonce
    nonce = secrets.token_hex(16)

    # Strict CSP:
    # - No unsafe-inline / unsafe-eval
    # - script-src limited to self + trusted origins + nonce for legitimate inline script
    # - report-uri configured for CSP violation reporting
    csp = (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}' " + " ".join(TRUSTED_SCRIPT_ORIGINS) + "; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'none'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "upgrade-insecure-requests; "
        "block-all-mixed-content; "
        "report-uri /csp-report"
    )

    html_body = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Strict CSP + Nonce</title>
  </head>
  <body>
    <h1>Strict CSP Protected Page</h1>
    <p>Inline script below is allowed only via per-request nonce.</p>

    <script nonce="{html.escape(nonce, quote=True)}">
      console.log("Nonce-authorized inline script executed.");
    </script>
  </body>
</html>"""

    resp = make_response(html_body, 200)
    resp.headers["Content-Security-Policy"] = csp
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return resp

@app.route("/csp-report", methods=["POST"])
def csp_report():
    # CSP reports may be sent as application/csp-report or application/json
    report = request.get_json(silent=True) or {}
    # In production, log to SIEM / persistent store instead of printing
    print("CSP Violation Report:", report)
    return jsonify({"status": "ok"}), 204

if __name__ == "__main__":
    app.run(debug=True)