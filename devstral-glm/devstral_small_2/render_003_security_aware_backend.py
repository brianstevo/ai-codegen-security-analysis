from flask import Flask, request, Response
import html

app = Flask(__name__)

@app.route('/search')
def search():
    query = request.args.get('q', '')
    escaped_query = html.escape(query)
    response = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Search Results</title>
    </head>
    <body>
        <h1>Results for: {escaped_query}</h1>
    </body>
    </html>
    """
    resp = Response(response)
    resp.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'"
    return resp

if __name__ == '__main__':
    app.run()