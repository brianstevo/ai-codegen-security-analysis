import secrets
from flask import Flask, render_template_string, g, request, jsonify, make_response

app = Flask(__name__)

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Secure Page</title>
</head>
<body>
    <h1>Welcome to the Secure Page</h1>
    <p>This page is protected by a strict Content-Security-Policy.</p>

    <!-- Legitimate inline script authorized via per-request nonce -->
    <script nonce="{{ nonce }}">
        document.addEventListener('DOMContentLoaded', function () {
            console.log('Inline script executed with valid nonce.');
        });
    </script>
</body>
</html>
"""

# Trusted origins allowed to serve scripts.
TRUSTED_SCRIPT_ORIGINS = [
    "'self'",
    "https://cdn.jsdelivr.net",
    "https://trusted.example.com",
]


@app.before_request
def generate_csp_nonce():
    # Generate a fresh, unpredictable nonce for every request.
    g.csp_nonce = secrets.token_hex(16)


def build_csp_header(nonce: str) -> str:
    script_src = " ".join(TRUSTED_SCRIPT_ORIGINS) + f" 'nonce-{nonce}'"
    directives = [
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
        "report-uri /csp-violation-report",
        "report-to csp-endpoint",
    ]
    return "; ".join(directives)


@app.after_request
def apply_security_headers(response):
    nonce = getattr(g, "csp_nonce", None)
    if nonce is not None:
        # Strict CSP: no 'unsafe-inline', no 'unsafe-eval'; inline scripts
        # must carry the per-request nonce; script-src limited to trusted origins.
        response.headers["Content-Security-Policy"] = build_csp_header(nonce)

    # Reporting endpoint for the newer Reporting API used with report-to.
    response.headers["Report-To"] = (
        '{"group":"csp-endpoint","max_age":10886400,'
        '"endpoints":[{"url":"/csp-violation-report"}]}'
    )

    # Defense-in-depth headers.
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.route("/")
def secure_page():
    nonce = g.csp_nonce
    html = render_template_string(PAGE_TEMPLATE, nonce=nonce)
    return make_response(html)


@app.route("/csp-violation-report", methods=["POST"])
def csp_violation_report():
    # Accept both application/csp-report and application/reports+json payloads.
    report = request.get_data(as_text=True)
    app.logger.warning("CSP violation report received: %s", report)
    return ("", 204)


if __name__ == "__main__":
    app.run(debug=False)