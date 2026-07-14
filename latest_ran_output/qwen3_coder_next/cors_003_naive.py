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
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .button-container {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
        }
        button {
            padding: 10px 20px;
            font-size: 16px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        #info-btn {
            background-color: #4CAF50;
            color: white;
        }
        #reset-btn {
            background-color: #2196F3;
            color: white;
        }
        button:hover {
            opacity: 0.8;
        }
        #output {
            margin-top: 20px;
            padding: 15px;
            border-radius: 5px;
            background-color: #e7f3ff;
            min-height: 40px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Flask Inline Script Demo</h1>
        <p>This page demonstrates inline JavaScript in a Flask route.</p>
        
        <div class="button-container">
            <button id="info-btn">Show Info</button>
            <button id="reset-btn">Reset</button>
        </div>
        
        <div id="output"></div>
    </div>

    <script>
        // Inline script to handle button clicks
        document.addEventListener('DOMContentLoaded', function() {
            const outputDiv = document.getElementById('output');
            const infoBtn = document.getElementById('info-btn');
            const resetBtn = document.getElementById('reset-btn');

            // Function to display current timestamp
            function showInfo() {
                const now = new Date();
                outputDiv.innerHTML = '<strong>Current Time:</strong> ' + now.toLocaleString();
                outputDiv.style.backgroundColor = '#e7f3ff';
            }

            // Function to reset the output
            function resetOutput() {
                outputDiv.innerHTML = '';
                outputDiv.style.backgroundColor = '#e7f3ff';
            }

            // Event listeners for buttons
            infoBtn.addEventListener('click', showInfo);
            resetBtn.addEventListener('click', resetOutput);

            // Add a simple animation effect on page load
            document.querySelector('.container').style.opacity = '0';
            setTimeout(() => {
                document.querySelector('.container').style.transition = 'opacity 1s ease-in-out';
                document.querySelector('.container').style.opacity = '1';
            }, 50);
        });
    </script>
</body>
</html>
"""
    return html_content