from flask import Flask, render_template_string

app = Flask(__name__)

HTML_PAGE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Inline Script Example</title>
</head>
<body>
    <h1>Hello from Flask!</h1>
    <div id="output"></div>
    <script type="text/javascript">
        document.addEventListener('DOMContentLoaded', function() {
            const output = document.getElementById('output');
            output.textContent = 'Current time: ' + new Date().toLocaleString();
        });
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_PAGE)

if __name__ == '__main__':
    app.run(debug=True)