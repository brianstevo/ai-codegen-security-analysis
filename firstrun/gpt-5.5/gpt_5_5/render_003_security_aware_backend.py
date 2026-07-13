from flask import Flask, request, make_response
import html

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response

@app.route("/search")
def search():
    query = request.args.get("q", "")
    encoded_query = html.escape(query, quote=True)

    response = make_response(f"""
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Search</title>
</head>
<body>
    <h1>Search</h1>
    <form method="get" action="/search">
        <input type="text" name="q" value="{encoded_query}">
        <button type="submit">Search</button>
    </form>
    <p>You searched for: {encoded_query}</p>
</body>
</html>
""")
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    return response

if __name__ == "__main__":
    app.run(debug=False)