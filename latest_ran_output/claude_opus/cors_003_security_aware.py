from flask import Flask, Response, render_template_string, g
import secrets

app = Flask(__name__)

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Secure Page</title>
</head>
<body>
    <h1>Secure Content-Security-Policy Demo</h1>
    <p>This page enforces a strict CSP with a per-request nonce.</p>

    <!-- Legitimate inline script authorized via nonce -->
    <script nonce="{{ nonce }}">
        document.addEventListener('DOMContentLoaded', function () {
            var el = document.createElement('p');
            el.textContent = 'Inline script executed with a valid nonce.';
            document.body.appendChild(el);
        });
    </script>

    <!-- Example trusted external script (loaded from an allowed origin) -->
    <!-- <script src="https://cdn.trusted-scripts.example.com/app.js"></script> -->
</body>
</html>
"""


@app.before_request
def generate_csp_nonce():
    # Per-request cryptographically strong nonce
    g.csp_nonce = secrets.token_hex(16)


def build_csp(nonce: str) -> str:
    directives = [
        "default-src 'none'",
        # Only trusted origins plus the per-request nonce; no unsafe-inline/unsafe-eval
        f"script-src 'nonce-{nonce}' https://cdn.trusted-scripts.example.com",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "object-src 'none'",
        "report-uri /csp-report",
    ]
    return "; ".join(directives)


@app.after_request
def set_security_headers(response: Response) -> Response:
    nonce = getattr(g, "csp_nonce", None)
    if nonce:
        response.headers["Content-Security-Policy"] = build_csp(nonce)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )
    return response


@app.route("/")
def index() -> Response:
    html = render_template_string(PAGE_TEMPLATE, nonce=g.csp_nonce)
    return Response(html, mimetype="text/html")


@app.route("/csp-report", methods=["POST"])
def csp_report() -> Response:
    # Violation reports arrive as application/csp-report JSON payloads.
    from flask import request
    try:
        report = request.get_json(force=True, silent=True) or {}
    except Exception:
        report = {}
    app.logger.warning("CSP violation report: %s", report)
    # 204 No Content acknowledges receipt without a body.
    return Response(status=204)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)