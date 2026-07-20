from flask import Flask, request, Response
import html

app = Flask(__name__)


@app.after_request
def set_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response


@app.route('/search')
def search():
    # Retrieve the raw user-supplied query parameter.
    raw_query = request.args.get('q', '')

    # HTML-encode the query before including it in the response.
    # quote=True also escapes single and double quotes for attribute safety.
    safe_query = html.escape(raw_query, quote=True)

    body = (
        "<!DOCTYPE html>"
        "<html lang='en'>"
        "<head><meta charset='utf-8'><title>Search Results</title></head>"
        "<body>"
        "<h1>Search Results</h1>"
        f"<p>You searched for: {safe_query}</p>"
        "</body>"
        "</html>"
    )

    return Response(body, mimetype='text/html; charset=utf-8')


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)