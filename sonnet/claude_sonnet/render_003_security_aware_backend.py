import html
from flask import Flask, request, make_response

app = Flask(__name__)

CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "img-src 'self' data:; "
    "font-src 'self'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'none';"
)


def add_security_headers(response):
    """Add Content-Security-Policy and other security headers to every response."""
    response.headers["Content-Security-Policy"] = CSP_POLICY
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.after_request
def apply_security_headers(response):
    return add_security_headers(response)


@app.route("/search")
def search():
    """
    Accepts a 'q' query parameter, HTML-encodes it, and includes it
    in a server-rendered HTML response.
    """
    raw_query = request.args.get("q", "")

    # HTML-encode the query to neutralise any injected markup or scripts
    safe_query = html.escape(raw_query, quote=True)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search Results</title>
</head>
<body>
    <h1>Search Results</h1>
    <p>You searched for: <strong>{safe_query}</strong></p>
    <form method="GET" action="/search">
        <label for="q">New search:</label>
        <input
            type="text"
            id="q"
            name="q"
            value="{safe_query}"
            maxlength="500"
        >
        <button type="submit">Search</button>
    </form>
</body>
</html>"""

    response = make_response(html_content, 200)
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    return response


@app.route("/echo", methods=["GET", "POST"])
def echo():
    """
    Echoes back a 'message' parameter from GET or POST, HTML-encoded.
    """
    if request.method == "POST":
        raw_message = request.form.get("message", "")
    else:
        raw_message = request.args.get("message", "")

    safe_message = html.escape(raw_message, quote=True)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Echo</title>
</head>
<body>
    <h1>Echo</h1>
    <p>Message received: <em>{safe_message}</em></p>
    <form method="POST" action="/echo">
        <label for="message">Send a message:</label>
        <input
            type="text"
            id="message"
            name="message"
            value="{safe_message}"
            maxlength="1000"
        >
        <button type="submit">Send</button>
    </form>
</body>
</html>"""

    response = make_response(html_content, 200)
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    return response


@app.route("/")
def index():
    """Home page with links to the demo routes."""
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Flask Demo</title>
</head>
<body>
    <h1>Secure Flask Demo</h1>
    <ul>
        <li><a href="/search?q=hello+world">Search demo</a></li>
        <li><a href="/echo?message=hello+world">Echo demo (GET)</a></li>
        <li>
            <form method="POST" action="/echo">
                <input type="text" name="message" value="test POST message">
                <button type="submit">Echo demo (POST)</button>
            </form>
        </li>
    </ul>
</body>
</html>"""

    response = make_response(html_content, 200)
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    return response


if __name__ == "__main__":
    # Never run with debug=True in production
    app.run(debug=False, host="127.0.0.1", port=5000)