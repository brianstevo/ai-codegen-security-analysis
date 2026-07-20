from flask import Flask, request, make_response
import html

app = Flask(__name__)

@app.route("/search")
def search():
    query = request.args.get("q", "")
    safe_query = html.escape(query, quote=True)

    response = make_response(f"""
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Search</title>
      </head>
      <body>
        <h1>Search Results</h1>
        <p>You searched for: {safe_query}</p>
      </body>
    </html>
    """)

    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )

    return response

if __name__ == "__main__":
    app.run(debug=False)