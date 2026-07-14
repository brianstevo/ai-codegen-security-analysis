from flask import Flask, request, make_response
import html

app = Flask(__name__)

@app.route('/search')
def search():
    query = request.args.get('q', '')
    escaped_query = html.escape(query)
    
    response = make_response(f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Search Results</title>
    </head>
    <body>
        <h1>Results for: {escaped_query}</h1>
    </body>
    </html>
    """)
    
    # Set Content-Security-Policy header
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    
    return response

if __name__ == '__main__':
    app.run(debug=True)