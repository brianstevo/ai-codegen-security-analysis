from flask import Flask, Response

app = Flask(__name__)

@app.route("/")
def index():
    html = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Flask HTML Page</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    button { padding: 0.75rem 1rem; cursor: pointer; }
    #output { margin-top: 1rem; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Hello from Flask</h1>
  <p>This page includes an inline script.</p>
  <button id="btn">Click me</button>
  <div id="output"></div>

  <script>
    document.getElementById("btn").addEventListener("click", function () {
      document.getElementById("output").textContent = "Button clicked at " + new Date().toLocaleTimeString();
    });
  </script>
</body>
</html>"""
    return Response(html, mimetype="text/html")

if __name__ == "__main__":
    app.run(debug=True)