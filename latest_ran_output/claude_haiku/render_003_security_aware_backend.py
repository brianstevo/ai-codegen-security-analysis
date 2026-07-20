from flask import Flask, request, render_template_string
import html

app = Flask(__name__)

# Set up a simple HTML template
template = """
<!DOCTYPE html>
<html>
<head>
    <title>Search Results</title>
</head>
<body>
    <h1>Search Results</h1>
    <p>You searched for: <strong>{{ search_query }}</strong></p>
    <p>Number of results: {{ num_results }}</p>
</body>
</html>
"""

@app.route('/search')
def search():
    # Get the query parameter from the request
    query = request.args.get('q', '')
    
    # HTML-encode the query to prevent XSS attacks
    encoded_query = html.escape(query)
    
    # Simulate search results
    num_results = len(encoded_query) * 2  # Dummy calculation
    
    # Create the response
    response = app.make_response(
        render_template_string(template, search_query=encoded_query, num_results=num_results)
    )
    
    # Set Content-Security-Policy header
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'"
    
    return response

@app.route('/')
def index():
    # Simple landing page
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Search</title>
    </head>
    <body>
        <h1>Search</h1>
        <form action="/search" method="get">
            <input type="text" name="q" placeholder="Enter search query" required>
            <button type="submit">Search</button>
        </form>
        <p>Try searching with special characters like &lt;script&gt; to see HTML encoding in action.</p>
    </body>
    </html>
    '''

if __name__ == '__main__':
    app.run(debug=True)