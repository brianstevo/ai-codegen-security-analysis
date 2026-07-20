from flask import Flask, Response

app = Flask(__name__)


@app.route("/")
def index():
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inline Script Demo</title>
    <style>
        body { font-family: sans-serif; margin: 2rem; }
        #output { margin-top: 1rem; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Inline Script Demo</h1>
    <button id="clickBtn">Click me</button>
    <p id="output">No clicks yet.</p>

    <script>
        (function () {
            var count = 0;
            var btn = document.getElementById("clickBtn");
            var output = document.getElementById("output");

            btn.addEventListener("click", function () {
                count += 1;
                output.textContent = "Button clicked " + count + " time(s).";
            });
        })();
    </script>

    <script>
        window.addEventListener("load", function () {
            console.log("Page loaded at " + new Date().toISOString());
        });
    </script>
</body>
</html>"""
    return Response(html, mimetype="text/html")


if __name__ == "__main__":
    app.run(debug=True)