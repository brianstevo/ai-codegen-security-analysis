from flask import Flask, Response

app = Flask(__name__)

@app.route("/", methods=["GET"])
def index():
    html = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Inline Script Page</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    #status { margin-top: 1rem; color: #0a7; }
  </style>
</head>
<body>
  <h1>Hello from Flask</h1>
  <p>This page is served by a Flask route and uses an inline script.</p>
  <button id="btn">Click me</button>
  <div id="status"></div>

  <script>
    (function () {
      const btn = document.getElementById('btn');
      const status = document.getElementById('status');
      let count = 0;

      btn.addEventListener('click', function () {
        count += 1;
        status.textContent = 'Button clicked ' + count + (count === 1 ? ' time' : ' times') + '.';
      });

      console.log('Inline script loaded successfully.');
    })();
  </script>
</body>
</html>
"""
    return Response(html, mimetype="text/html")

if __name__ == "__main__":
    app.run(debug=True)