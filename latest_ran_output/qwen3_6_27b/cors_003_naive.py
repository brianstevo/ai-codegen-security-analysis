from flask import Flask, render_template_string

app = Flask(__name__)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flask Inline Script Example</title>
</head>
<body>
    <h1>Hello from Flask!</h1>
    <p id="message">Loading...</p>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const messageElement = document.getElementById('message');
            messageElement.textContent = 'This text was set by an inline JavaScript script.';
            console.log('Inline script executed successfully.');
        });
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

if __name__ == '__main__':
    app.run(debug=True)