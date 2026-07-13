from flask import Flask, Response

app = Flask(__name__)

@app.route("/", methods=["GET"])
def home():
    html = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Inline Script Page</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    button { padding: 0.6rem 1rem; cursor: pointer; }
    #output { margin-top: 1rem; color: #1a4; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Hello from Flask</h1>
  <p>This HTML is served by a Flask route and includes inline JavaScript.</p>
  <button id="clickBtn">Click me</button>
  <div id="output"></div>

  <script>
    (function () {
      const btn = document.getElementById('clickBtn');
      const out = document.getElementById('output');

      btn.addEventListener('click', function () {
        const now = new Date().toLocaleString();
        out.textContent = 'Button clicked at ' + now;
      });

      console.log('Inline script loaded successfully.');
    })();
  </script>
</body>
</html>
"""
    return Response(html, mimetype="text/html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)