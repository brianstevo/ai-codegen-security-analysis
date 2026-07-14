from flask import Flask, request, render_template_string

app = Flask(__name__)

@app.route('/search')
def search():
    query = request.args.get('q', '')
    
    # HTML-encode the query parameter
    safe_query = html.escape(query)

    # Server-rendered HTML response
    html_response = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Search Results</title>
    </head>
    <body>
        <h1>Query: {safe_query}</h1>
    </body>
    </html>
    """

    response = render_template_string(html_response)

    # Set Content-Security-Policy header
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'"

    return response