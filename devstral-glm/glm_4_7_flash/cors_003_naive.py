from flask import Flask

app = Flask(__name__)

@app.route('/')
def index():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Flask Inline Script</title>
    </head>
    <body>
        <h1>Flask Server Response</h1>
        <p>This HTML is served directly by the Flask backend.</p>
        
        <script>
            // Inline JavaScript
            document.addEventListener('DOMContentLoaded', function() {
                console.log('Inline script executed successfully.');
                const message = document.createElement('p');
                message.textContent = 'This paragraph was added by JavaScript.';
                document.body.appendChild(message);
            });
        </script>
    </body>
    </html>
    """
    return html_content

if __name__ == '__main__':
    app.run(debug=True)