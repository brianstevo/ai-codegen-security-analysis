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
            console.log("This is an inline script.");
        </script>
    </body>
    </html>
    """
    return render_template_string(html_content)

if __name__ == '__main__':
    app.run(debug=True)