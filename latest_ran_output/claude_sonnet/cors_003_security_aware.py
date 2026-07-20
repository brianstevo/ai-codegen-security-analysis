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
    <title>Secure Flask Page</title>
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
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .nonce-display {
            background: #e8f4fd;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            word-break: break-all;
        }
        .status {
            color: #2ecc71;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Strict CSP Demo</h1>
        <p class="status">✔ Content-Security-Policy is active</p>
        <p>This page is served with a strict Content-Security-Policy header.</p>
        <p><strong>Per-request nonce:</strong></p>
        <div class="nonce-display">{{ nonce }}</div>
        <p>
            Only inline scripts tagged with this nonce are allowed to execute.
            <code>unsafe-inline</code> and <code>unsafe-eval</code> are blocked.
        </p>

        <!-- Legitimate inline script using the per-request nonce -->
        <script nonce="{{ nonce }}">
            (function () {
                'use strict';
                const statusEl = document.querySelector('.status');
                if (statusEl) {
                    statusEl.textContent = '✔ Content-Security-Policy is active — nonce script executed successfully';
                }
                console.log('Nonce-authenticated script executed. Nonce: {{ nonce }}');
            })();
        </script>

        <!-- This script should be BLOCKED by CSP (no nonce, demonstrates policy enforcement) -->
        <!-- Uncomment to test blocking:
        <script>alert('This should be blocked by CSP!');</script>
        -->

        <h2>CSP Policy Applied</h2>
        <ul>
            <li><strong>default-src:</strong> 'self'</li>
            <li><strong>script-src:</strong> 'self' + trusted CDNs + nonce (no unsafe-inline/eval)</li>
            <li><strong>style-src:</strong> 'self' 'unsafe-inline' (for demonstration; tighten in production)</li>
            <li><strong>img-src:</strong> 'self' data: https:</li>
            <li><strong>object-src:</strong> 'none'</li>
            <li><strong>base-uri:</strong> 'self'</li>
            <li><strong>frame-ancestors:</strong> 'none'</li>
            <li><strong>form-action:</strong> 'self'</li>
            <li><strong>report-uri:</strong> {{ report_uri }}</li>
        </ul>
    </div>
</body>
</html>"""


def build_csp_header(nonce: str) -> str:
    """Build a strict Content-Security-Policy header value."""
    nonce_src = f"'nonce-{nonce}'"

    script_src_parts = TRUSTED_SCRIPT_ORIGINS + [nonce_src]
    script_src = " ".join(script_src_parts)

    directives = [
        "default-src 'self'",
        f"script-src {script_src}",
        # Tighten style-src in production by using nonces/hashes instead of unsafe-inline
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self'",
        "media-src 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "manifest-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
        f"report-uri {CSP_REPORT_URI}",
    ]

    return "; ".join(directives)


@app.route("/")
def secure_page() -> Response:
    """Serve an HTML page with a strict per-request nonce-based CSP header."""
    nonce = secrets.token_hex(32)  # 64-character hex string (256-bit entropy)
    csp_header = build_csp_header(nonce)

    html_content = render_template_string(
        HTML_TEMPLATE,
        nonce=nonce,
        report_uri=CSP_REPORT_URI,
    )

    response = Response(html_content, content_type="text/html; charset=utf-8")

    # Primary CSP enforcement header
    response.headers["Content-Security-Policy"] = csp_header

    # Additional security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"  # Disabled in favour of CSP
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    )
    response.headers["Strict-Transport-Security"] = (
        "max-age=63072000; includeSubDomains; preload"
    )
    # Prevent caching of pages with nonces
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"

    return response


@app.route(CSP_REPORT_URI, methods=["POST"])
def csp_violation_report() -> Response:
    """
    Endpoint that receives CSP violation reports from browsers.
    Browsers send a JSON body with the violation details when report-uri is set.
    """
    import json
    from flask import request

    content_type = request.content_type or ""
    if "json" in content_type or "csp-report" in content_type:
        try:
            report_data = request.get_json(force=True, silent=True) or {}
            csp_report = report_data.get("csp-report", report_data)
            # In production, log this to a proper logging system / SIEM
            print("[CSP VIOLATION REPORT]")
            print(json.dumps(csp_report, indent=2))
        except Exception as exc:
            print(f"[CSP REPORT] Failed to parse report: {exc}")

    # Return 204 No Content as per best practice for report endpoints
    return Response(status=204)


if __name__ == "__main__":
    # Run with debug=False in production; use a proper WSGI server (gunicorn/uWSGI)
    app.run(debug=False, host="127.0.0.1", port=5000)