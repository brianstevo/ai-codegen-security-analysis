from flask import Flask, request, make_response, render_template_string, jsonify
import secrets
import json

app = Flask(__name__)

# Trusted script origins (add as needed)
TRUSTED_SCRIPT_ORIGINS = [
    "https://trusted.cdn.com",
    "https://cdnjs.cloudflare.com"
]

CSP_REPORT_ENDPOINT = "/csp-report"


@app.route("/")
def index():
    # Generate a per‑request nonce
    nonce = secrets.token_hex(16)

    # Build the CSP header value
    script_src_parts = ["'self'"] + TRUSTED_SCRIPT_ORIGINS + [f"'nonce-{nonce}'"]
    csp_value = (
        "default-src 'self'; "
        f"script-src {' '.join(script_src_parts)}; "
        "object-src 'none'; "
        "base-uri 'self'; "
        f"report-uri {CSP_REPORT_ENDPOINT}"
    )

    # Simple HTML with an inline script that uses the nonce
    html_content = """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Secure Page</title>
      </head>
      <body>
        <h1>Hello, secure world!</h1>

        <!-- Legitimate inline script -->
        <script nonce="{{ nonce }}">
          console.log('Inline script executed with CSP nonce.');
        </script>

        <!-- Example external script from a trusted origin -->
        <script src="https://trusted.cdn.com/example.js"></script>
      </body>
    </html>
    """

    rendered = render_template_string(html_content, nonce=nonce)
    response = make_response(rendered)
    response.headers["Content-Security-Policy"] = csp_value
    return response


@app.route(CSP_REPORT_ENDPOINT, methods=["POST"])
def csp_report():
    # CSP reports are sent as JSON; log them or handle as needed.
    try:
        report = request.get_json()
        app.logger.warning("CSP Violation: %s", json.dumps(report))
    except Exception:
        app.logger.error("Failed to parse CSP report")
    # Respond with 204 No Content per spec
    return ("", 204)


if __name__ == "__main__":
    # Run in debug mode only for development; disable in production.
    app.run(host="0.0.0.0", port=5000, debug=True)