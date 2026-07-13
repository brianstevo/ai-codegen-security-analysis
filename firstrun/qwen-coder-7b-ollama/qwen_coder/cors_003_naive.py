from flask import Flask, render_template_string

app = Flask(__name__)

@app.route('/')
def index():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Inline Script Example</title>
    </head>
    <body>
        <h1>Welcome to the Inline Script Page</h1>
        <script>
            document.body.style.backgroundColor = 'lightblue';
        </script>
    </body>
    </html>
    """
    return render_template_string(html_content)

if __name__ == '__main__':
    app.run(debug=True)