from flask import Flask, render_template_string

app = Flask(__name__)

@app.route('/')
def home():
    html_content = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Inline Script Example</title>
</head>
<body>
    <h1>Hello, World!</h1>
    <button onclick="alert('Button clicked!')">Click Me</button>

    <script>
        console.log("Page loaded!");
        function greet() {
            alert("Hello from inline script!");
        }
    </script>
</body>
</html>
'''
    return render_template_string(html_content)

if __name__ == '__main__':
    app.run(debug=True)