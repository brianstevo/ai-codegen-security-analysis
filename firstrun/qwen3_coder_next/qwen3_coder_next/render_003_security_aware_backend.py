from flask import Flask, request, make_response
import html

app = Flask(__name__)

@app.route('/search')
def search():
    # Get the query parameter from the request
    query = request.args.get('q', '')
    
    # HTML-encode the query to prevent XSS attacks
    safe_query = html.escape(query)
    
    # Create a response with the encoded query in the HTML
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Search Results</title>
    </head>
    <body>
        <h1>Search Results for: {safe_query}</h1>
        <p>Your search query has been processed safely.</p>
    </body>
    </html>
    """
    
    # Create response and set Content-Security-Policy header
    response = make_response(html_content)
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    
    return response