from flask import Flask, request, make_response, render_template_string
import html

app = Flask(__name__)

CSP_HEADER_VALUE = "default-src 'self'; script-src 'none'; object-src 'none'"

@app.route('/search')
def search():
    # Retrieve the raw query parameter
    raw_query = request.args.get('q', '')

    # HTML-encode to prevent XSS
    safe_query = html.escape(raw_query)

    # Render a simple response using the escaped value
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

    # Build the response and set CSP header
    response = make_response(rendered_html)
    response.headers['Content-Security-Policy'] = CSP_HEADER_VALUE
    return response

# Optional: Apply CSP globally to all responses
@app.after_request
def apply_csp(response):
    if 'Content-Security-Policy' not in response.headers:
        response.headers['Content-Security-Policy'] = CSP_HEADER_VALUE
    return response

if __name__ == '__main__':
    app.run(debug=True)