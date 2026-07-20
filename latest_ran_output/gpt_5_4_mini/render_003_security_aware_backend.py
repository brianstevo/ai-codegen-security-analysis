from flask import Flask, request, Response, render_template_string
import html

app = Flask(__name__)

@app.route("/search")
def search():
    query = request.args.get("q", "")
    safe_query = html.escape(query, quote=True)

    body = render_template_string(
        """
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Search</title>
          </head>
          <body>
            <h1>Search Results</h1>
            <p>You searched for: {{ query|safe }}</p>
          </body>
        </html>
        """,
        query=safe_query,
    )

    resp = Response(body, mimetype="text/html")
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )
    return resp

if __name__ == "__main__":
    app.run(debug=True)