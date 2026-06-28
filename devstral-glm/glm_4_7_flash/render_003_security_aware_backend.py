from flask import Flask, request, render_template_string
import html

app = Flask(__name__)

@app.route('/search')
def search():
    # Retrieve the query parameter from the URL
    raw_query = request.args.get('q', '')

    # HTML-encode the query to prevent XSS
    safe_query = html.escape(raw_query, quote=True)

    # Define a simple HTML template for server-side rendering
    template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Search Results</title>
    </head>
    <body>
        <h1>Results</h1>
        <p>You searched for: {{ safe_query }}</p>
    </body>
    </html>
    """

    # Render the template with the encoded variable
    response = render_template_string(template, safe_query=safe_query)

    # Set the Content-Security-Policy header
    response.headers['Content-Security-Policy'] = "default-src 'self'"

    return response