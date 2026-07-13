from flask import Flask, request, make_response
import html

app = Flask(__name__)

@app.route('/search')
def search():
    query = request.args.get('q', '')
    
    # HTML-encode the query to prevent XSS in server-rendered responses
    safe_query = html.escape(query)
    
    # Create a simple HTML response including the sanitized query
    response_body = f"<html><body><h1>Search Results for: {safe_query}</h1></body></html>"
    
    response = make_response(response_body)
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    
    # Set Content-Security-Policy header to restrict resource loading
    csp = (
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
    response.headers['Content-Security-Policy'] = csp
    
    return response

if __name__ == '__main__':
    app.run(debug=True)