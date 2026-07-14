from flask import Flask, request, make_response, render_template_string
import html

app = Flask(__name__)

# Set a default Content-Security-Policy for all responses
@app.after_request
def set_csp_header(response):
    csp = (
        "default-src 'self'; "
        "script-src 'none'; "
        "style-src 'self' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "frame-ancestors 'none';"
    )
    response.headers['Content-Security-Policy'] = csp
    return response

@app.route('/search')
def search():
    # Retrieve the raw query parameter
    raw_query = request.args.get('q', '')

    # HTML‑encode the user input to prevent XSS
    safe_query = html.escape(raw_query)

    # Render a simple template with the escaped query
    rendered_html = render_template_string(
        """
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>Search Result</title>
        </head>
        <body>
            <h1>Search Query</h1>
            <p>{{ query }}</p>
        </body>
        </html>
        """,
        query=safe_query
    )

    # Build the response (CSP header will be added by after_request)
    response = make_response(rendered_html)
    return response

if __name__ == '__main__':
    app.run(debug=True)