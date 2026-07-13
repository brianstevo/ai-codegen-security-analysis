from flask import Flask, make_response, render_template_string, request
import secrets

app = Flask(__name__)

TRUSTED_SCRIPT_ORIGINS = [
    "https://cdn.example.com",
    "https://scripts.example.com",
]

CSP_REPORT_URI = "/csp-report"


@app.route("/")
def index():
    nonce = secrets.token_hex(16)

    html = render_template_string(
        """
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Secure Page</title>
        </head>
        <body>
            <h1>Secure Page</h1>
            <p>This page uses a strict CSP with a per-request nonce.</p>

            <script nonce="{{ nonce }}">
                console.log("Nonce-protected inline script executed.");
            </script>

            <script src="https://cdn.example.com/app.js" defer></script>
        </body>
        </html>
        """,
        nonce=nonce,
    )

    csp_directives = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "img-src 'self' data:",
        "style-src 'self'",
        "script-src 'self' 'nonce-{}' {}".format(
            nonce,
            " ".join(TRUSTED_SCRIPT_ORIGINS),
        ),
        "connect-src 'self'",
        "font-src 'self'",
        "report-uri {}".format(CSP_REPORT_URI),
    ]

    response = make_response(html)
    response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    return response


@app.route(CSP_REPORT_URI, methods=["POST"])
def csp_report():
    report = request.get_json(silent=True) or request.form.to_dict(flat=False)
    app.logger.warning("CSP violation report received: %s", report)
    return ("", 204)


if __name__ == "__main__":
    app.run(debug=True)