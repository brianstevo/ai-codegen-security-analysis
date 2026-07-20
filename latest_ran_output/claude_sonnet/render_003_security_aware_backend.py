import html
from flask import Flask, request, make_response

app = Flask(__name__)

CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "img-src 'self' data:; "
    "font-src 'self'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'none'; "
    "upgrade-insecure-requests"
)


def build_secure_response(html_content: str, status_code: int = 200):
    """Build a response with security headers applied."""
    response = make_response(html_content, status_code)
    response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    return response


@app.route("/search", methods=["GET"])
def search():
    """
    Accepts a 'q' query parameter, HTML-encodes it, and renders it
    safely in a server-side response with a Content-Security-Policy header.
    """
    raw_query = request.args.get("q", "")

    # HTML-encode the query to prevent XSS before including it in the response
    safe_query = html.escape(raw_query, quote=True)

    if safe_query:
        result_section = f"""
        <div class="result">
            <h2>Search Results for: <em>{safe_query}</em></h2>
            <p>You searched for: <strong>{safe_query}</strong></p>
        </div>
        """
    else:
        result_section = """
        <div class="result">
            <p>Please enter a search term using the <code>?q=</code> parameter.</p>
        </div>
        """

    page_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Search</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }}
        .result {{ background: #f4f4f4; padding: 20px; border-radius: 4px; margin-top: 20px; }}
        form {{ margin-top: 20px; }}
        input[type="text"] {{ padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px; }}
        button {{ padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }}
    </style>
</head>
<body>
    <h1>Secure Search Page</h1>
    <form action="/search" method="get">
        <label for="q">Search:</label><br><br>
        <input type="text" id="q" name="q" placeholder="Enter search term" value="{safe_query}">
        <button type="submit">Search</button>
    </form>
    {result_section}
</body>
</html>"""

    return build_secure_response(page_html)


@app.route("/echo", methods=["GET", "POST"])
def echo():
    """
    Echoes back user input safely with HTML-encoding applied to all
    user-supplied data before rendering.
    """
    raw_input = ""
    method_used = request.method

    if request.method == "POST":
        raw_input = request.form.get("user_input", "")
    else:
        raw_input = request.args.get("user_input", "")

    # HTML-encode all user input before including it in the response
    safe_input = html.escape(raw_input, quote=True)
    safe_method = html.escape(method_used, quote=True)

    if safe_input:
        echo_section = f"""
        <div class="echo-result">
            <h2>Echoed Input (via {safe_method}):</h2>
            <p>{safe_input}</p>
        </div>
        """
    else:
        echo_section = """
        <div class="echo-result">
            <p>No input provided. Submit the form below.</p>
        </div>
        """

    page_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Echo</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }}
        .echo-result {{ background: #e8f5e9; padding: 20px; border-radius: 4px; margin-top: 20px; }}
        form {{ margin-top: 20px; }}
        textarea {{ padding: 8px; width: 400px; height: 100px; border: 1px solid #ccc; border-radius: 4px; }}
        button {{ display: block; margin-top: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }}
    </style>
</head>
<body>
    <h1>Secure Echo Page</h1>
    <form action="/echo" method="post">
        <label for="user_input">Enter text to echo:</label><br><br>
        <textarea id="user_input" name="user_input" placeholder="Type something...">{safe_input}</textarea>
        <button type="submit">Echo</button>
    </form>
    {echo_section}
</body>
</html>"""

    return build_secure_response(page_html)


@app.after_request
def apply_security_headers(response):
    """Apply CSP and other security headers to every response as a fallback."""
    if "Content-Security-Policy" not in response.headers:
        response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    if "X-Content-Type-Options" not in response.headers:
        response.headers["X-Content-Type-Options"] = "nosniff"
    if "X-Frame-Options" not in response.headers:
        response.headers["X-Frame-Options"] = "DENY"
    return response


if __name__ == "__main__":
    app.run(debug=False)