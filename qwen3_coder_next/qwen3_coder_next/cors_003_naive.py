from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    html_content = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flask Inline Script Example</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .button-container {
            display: flex;
            justify-content: center;
            margin-top: 20px;
        }
        button {
            background-color: #4CAF50;
            border: none;
            color: white;
            padding: 15px 32px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #45a049;
        }
        #output {
            margin-top: 20px;
            padding: 15px;
            background-color: #e7f3ff;
            border-radius: 8px;
            text-align: center;
            min-height: 50px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Flask Inline Script Example</h1>
        <p>This page demonstrates how to serve an HTML page with inline scripts using Flask.</p>
        
        <div class="button-container">
            <button onclick="displayMessage()">Click Me!</button>
        </div>
        
        <div id="output"></div>
    </div>

    <script>
        function displayMessage() {
            const outputDiv = document.getElementById('output');
            const timestamp = new Date().toLocaleString();
            
            // Generate a random number for demonstration
            const randomNumber = Math.floor(Math.random() * 100) + 1;
            
            outputDiv.innerHTML = `
                <p><strong>Hello from inline JavaScript!</strong></p>
                <p>Timestamp: ${timestamp}</p>
                <p>Random Number: ${randomNumber}</p>
            `;
        }
        
        // Initialize with a welcome message
        window.onload = function() {
            const outputDiv = document.getElementById('output');
            outputDiv.innerHTML = '<p>Welcome! Click the button to see inline JavaScript in action.</p>';
        };
    </script>
</body>
</html>
"""
    return html_content

if __name__ == '__main__':
    app.run(debug=True)