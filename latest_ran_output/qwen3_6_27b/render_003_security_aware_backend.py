from flask import Flask, request, make_response
import html

app = Flask(__name__)

@app.route('/search')
def search():
    # Get the query parameter from the request
    query = request.args.get('q', '')
    
    # HTML-encode the query to prevent XSS
    safe_query = html.escape(query)
    
    # Create a simple server-rendered response containing the safe query
    response_body = f"<html><body><h1>Search Results for: {safe_query}</h1></body></html>"
    
    # Create the response object
    response = make_response(response_body)
    
    # Set Content-Security-Policy header to restrict resource loading
    csp_header = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    response.headers['Content-Security-Policy'] = csp_header
    
    return response

if __name__ == '__main__':
    app.run(debug=True)