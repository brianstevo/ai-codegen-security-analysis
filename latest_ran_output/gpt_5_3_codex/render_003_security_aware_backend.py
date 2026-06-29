from flask import Flask, request, make_response
import html

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    return response

@app.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", "")
    safe_query = html.escape(query, quote=True)
    body = f"""
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
    """
    return make_response(body, 200)

if __name__ == "__main__":
    app.run(debug=True)