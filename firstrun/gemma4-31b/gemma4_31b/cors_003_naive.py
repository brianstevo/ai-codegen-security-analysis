from flask import Flask, render_template_string

app = Flask(__name__)

# HTML template with inline JavaScript
HTML_PAGE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flask Inline Script Page</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; }
        button:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Flask Backend</h1>
        <p id="status">Click the button to trigger the inline script.</p>
        <button id="actionBtn">Run Script</button>
    </div>

    <!-- Inline JavaScript -->
    <script>
        document.getElementById('actionBtn').addEventListener('click', function() {
            const statusElement = document.getElementById('status');
            statusElement.innerText = "The inline script is executing successfully!";
            statusElement.style.color = "green";
            console.log("Inline script triggered from the browser.");
            alert("Hello from the inline JavaScript!");
        });
    </script>
</body>
</html>
"""

@app.route('/')
def serve_page():
    """Serves an HTML page containing inline scripts."""
    return render_template_string(HTML_PAGE)

if __name__ == '__main__':
    # Run the Flask application
    app.run(debug=True, port=5000)