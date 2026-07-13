from flask import Flask, request, render_template_string, jsonify, make_response
import secrets

app = Flask(__name__)

# Trusted script origins (add as needed)
TRUSTED_SCRIPT_SRC = [
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net"
]

CSP_REPORT_URI = "/csp-report"

HTML_TEMPLATE = """
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Secure Page</title>
</head>
<body>
<h1>Hello, secure world!</h1>

<script nonce="{{ nonce }}">
// Example inline script using the per‑request nonce
console.log('Nonce works!');
</script>

<!-- External trusted script -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
</body>
</html>
"""

def build_csp_header(nonce: str) -> str:
    """
    Construct a strict Content‑Security‑Policy header.
    - Disallows 'unsafe-inline' and 'unsafe-eval'.
    - Allows scripts from self, trusted origins, and the generated nonce.
    - Sets a report-uri for violation reporting.
    """
    script_src = ["'self'"] + TRUSTED_SCRIPT_SRC + [f"'nonce-{nonce}'"]
    csp_parts = [
        "default-src 'self'",
        f"script-src {' '.join(script_src)}",
        "object-src 'none'",
        "base-uri 'self'",
        f"report-uri {CSP_REPORT_URI}"
    ]
    return "; ".join(csp_parts)

@app.route("/")
def index():
    # Generate a per‑request nonce
    nonce = secrets.token_hex(16)
    csp_header = build_csp_header(nonce)

    rendered_html = render_template_string(HTML_TEMPLATE, nonce=nonce)
    response = make_response(rendered_html)
    response.headers["Content-Security-Policy"] = csp_header
    return response

@app.route(CSP_REPORT_URI, methods=["POST"])
def csp_report():
    """
    Endpoint to receive CSP violation reports.
    In a real application you would store or alert on these reports.
    """
    try:
        report = request.get_json()
        app.logger.warning("CSP Violation Report: %s", report)
    except Exception as e:
        app.logger.error("Failed to parse CSP report: %s", e)
    # 204 No Content indicates receipt without a response body
    return "", 204

if __name__ == "__main__":
    app.run(debug=True)