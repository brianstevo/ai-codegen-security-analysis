from flask import Flask, render_template_string

app = Flask(__name__)

# HTML template with inline CSS and JavaScript
HTML_PAGE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flask Inline Script Page</title>
    <style>
        body { 
            font-family: sans-serif; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            background-color: #f0f2f5; 
        }
        .card { 
            background: white; 
            padding: 2rem; 
            border-radius: 8px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
            text-align: center; 
        }
        button { 
            padding: 10px 20px; 
            font-size: 16px; 
            cursor: pointer; 
            background-color: #007bff; 
            color: white; 
            border: none; 
            border-radius: 4px; 
        }
        button:hover { background-color: #0056b3; }
    </style>
</head>
<body>

    <div class="card">
        <h1>Flask Backend</h1>
        <p id="status">Click the button to trigger the inline script.</p>
        <button id="actionBtn">Run JavaScript</button>
    </div>

    <!-- Inline Script -->
    <script>
        document.getElementById('actionBtn').addEventListener('click', function() {
            const statusText = document.getElementById('status');
            statusText.innerText = "The inline script is working perfectly!";
            statusText.style.color = "green";
            statusText.style.fontWeight = "bold";
            
            console.log("Button clicked: JavaScript executed in the browser.");
            alert("Hello from the inline script!");
        });
    </script>

</body>
</html>
"""

@app.route('/')
def index():
    """Serves the HTML page with embedded scripts."""
    return render_template_string(HTML_PAGE)

if __name__ == '__main__':
    # Run the application
    app.run(debug=True, port=5000)