```python
import secrets
from flask import Flask, Response, render_template_string

app = Flask(__name__)

# Trusted origins for scripts (adjust as needed)
TRUSTED_SCRIPT_ORIGINS = [
    "'self'",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
]

CSP_REPORT_URI = "/csp-violation-report"

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .nonce-display {
            background: #e8f4f8;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            word-break: break-all;
        }
        .status {
            color: #28a745;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Content Security Policy Demo</h1>
        <p class="status">✓ CSP header is active on this page</p>

        <h2>Current Request Nonce</h2>
        <p class="nonce-display">{{ nonce }}</p>

        <h2>Inline Script (Authorized via Nonce)</h2>
        <p id="script-output">Waiting for script...</p>

        <!-- This script is allowed because it carries the per-request nonce -->
        <script nonce="{{ nonce }}">
            document.addEventListener('DOMContentLoaded', function () {
                const output = document.getElementById('script-output');
                output.textContent = 'Inline script executed successfully at: ' + new Date().toISOString();
                output.style.color = '#28a745';
            });
        </script>

        <!-- This script would be BLOCKED by CSP (no nonce, no src whitelist match) -->
        <!-- <script>alert('This would be blocked!')</script> -->

        <h2>CSP Policy Applied</h2>
        <ul>
            <li><strong>default-src:</strong> 'self'</li>
            <li><strong>script-src:</strong> trusted origins + nonce (no unsafe-inline, no unsafe-eval)</li>
            <li><strong>style-src:</strong> 'self' + inline styles allowed via nonce</li>
            <li><strong>img-src:</strong> 'self' + data URIs</li>
            <li><strong>connect-src:</strong> 'self'</li>
            <li><strong>font-src:</strong> 'self'</li>
            <li><strong>object-src:</strong> 'none'</li>
            <li><strong>base-uri:</strong> 'self'</li>
            <li><strong>form-action:</strong> 'self'</li>
            <li><strong>frame-ancestors:</strong> 'none'</li>
            <li><strong>report-uri:</strong> {{ report_uri }}</li>
        </ul>
    </div>
</body>
</html>
"""


def build_csp_header(nonce: str) -> str:
    """Build a strict Content-Security-Policy header value."""
    nonce_value = f"'nonce-{nonce}'"

    # Build script-src: trusted origins + nonce only (no unsafe-inline or unsafe-eval)
    script_src_sources = TRUSTED_SCRIPT_ORIGINS + [nonce_value]
    script_src = " ".join(script_src_sources)

    # Style-src allows self and nonce for inline styles (no unsafe-inline)
    style_src = f"'self' {nonce_value}"

    directives = {
        "default-src":     "'self'",
        "script-src":      script_src,
        "style-src":       style_src,
        "img-src":         "'self' data:",
        "connect-src":     "'self'",
        "font-src":        "'self'",
        "object-src":      "'none'",
        "media-src":       "'none'",
        "frame-src":       "'none'",
        "base-uri":        "'self'",
        "form-action":     "'self'",
        "frame-ancestors": "'none'",
        "manifest-src":    "'self'",
        "worker-src":      "'none'",
        "report-uri":      CSP_REPORT_URI,
    }

    return "; ".join(f"{key} {value}" for key, value in directives.items())


@app.route("/")
def secure_page() -> Response:
    """Serve the main secure page with CSP headers."""
    nonce = secrets.token_hex(32)  # 64-character hex nonce, 256 bits of entropy

    csp_header = build_csp_header(nonce)

    html_content = render_template_string(
        HTML_TEMPLATE,
        nonce=nonce,
        report_uri=CSP_REPORT_URI,
    )

    response = Response(html_content, status=200, content_type="text/html; charset=utf-8")

    # Primary CSP enforcement header
    response.headers["Content-Security-Policy"] = csp_header

    # Report-Only mode header (useful for testing new policies without breaking the page)
    # Uncomment to enable report-only mode alongside the enforcing header:
    # response.headers["Content-Security-Policy-Report-Only"] = build_csp_header(nonce)

    # Additional security headers
    response.headers["X-Content-Type-Options"]     = "nosniff"
    response.headers["X-Frame-Options"]            = "DENY"
    response.headers["X-XSS-Protection"]           = "1; mode=block"
    response.headers["Referrer-Policy"]            = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]         = (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    )
    response.headers["Strict-Transport-Security"]  = "max-age=63072000; includeSubDomains; preload"

    return response


@app.route(CSP_REPORT_URI, methods=["POST"])
def csp_violation_report() -> Response:
    """
    Endpoint to receive CSP violation reports from browsers.
    Browsers send JSON payloads when a CSP directive is violated.
    """
    import json
    from flask import request

    content_type = request.content_type or ""

    if "json" in content_type:
        try:
            report_data = request.get_json(force=True, silent=True)
            if report_data:
                # Log the violation report (replace with proper logging in production)
                print("[CSP VIOLATION REPORT]", json.dumps(report_data, indent=2))
            else:
                print("[CSP VIOLATION REPORT] Empty or unparseable JSON body received.")
        except Exception as exc:
            print(f"[CSP VIOLATION REPORT] Error parsing report: {exc}")
    else:
        raw = request.get_data(as_text=True)
        print(f"[CSP VIOLATION REPORT] Raw payload (content-type={content_type!r}): {raw}")

    # Return 204 No Content — the browser does not need a response body
    return Response(status=204)


@app.errorhandler(404)
def not_found(error) -> Response:
    response = Response("<h1