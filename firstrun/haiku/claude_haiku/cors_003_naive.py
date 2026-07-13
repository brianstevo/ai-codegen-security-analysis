from flask import Flask, render_string

app = Flask(__name__)

@app.route('/')
def index():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Flask HTML with Inline Scripts</title>
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
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
                color: #333;
                border-bottom: 2px solid #007bff;
                padding-bottom: 10px;
            }
            button {
                background-color: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                margin: 10px 0;
            }
            button:hover {
                background-color: #0056b3;
            }
            #output {
                margin-top: 20px;
                padding: 15px;
                background-color: #e7f3ff;
                border-left: 4px solid #007bff;
                border-radius: 4px;
                display: none;
            }
            #output.show {
                display: block;
            }
            .timestamp {
                color: #666;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Flask HTML with Inline Scripts</h1>
            <p>Click the buttons below to see JavaScript in action:</p>
            
            <button onclick="handleClick()">Click Me!</button>
            <button onclick="greetUser()">Greet User</button>
            <button onclick="calculateSum()">Calculate 5 + 3</button>
            <button onclick="toggleOutput()">Toggle Output</button>
            <button onclick="clearOutput()">Clear Output</button>
            
            <div id="output"></div>
        </div>

        <script>
            function handleClick() {
                const output = document.getElementById('output');
                output.innerHTML = '<strong>Button Clicked!</strong><p>You clicked the button at ' + new Date().toLocaleTimeString() + '</p>';
                output.classList.add('show');
            }

            function greetUser() {
                const name = prompt('What is your name?');
                const output = document.getElementById('output');
                if (name) {
                    output.innerHTML = '<strong>Greeting</strong><p>Hello, ' + name + '! Welcome to this Flask app.</p>';
                } else {
                    output.innerHTML = '<strong>No Name Provided</strong><p>You cancelled the prompt.</p>';
                }
                output.classList.add('show');
            }

            function calculateSum() {
                const output = document.getElementById('output');
                const sum = 5 + 3;
                output.innerHTML = '<strong>Math Calculation</strong><p>5 + 3 = ' + sum + '</p>';
                output.classList.add('show');
            }

            function toggleOutput() {
                const output = document.getElementById('output');
                if (output.classList.contains('show')) {
                    output.classList.remove('show');
                } else if (output.innerHTML) {
                    output.classList.add('show');
                } else {
                    output.innerHTML = '<strong>Toggle Activated</strong><p>This is the toggled output.</p>';
                    output.classList.add('show');
                }
            }

            function clearOutput() {
                const output = document.getElementById('output');
                output.innerHTML = '';
                output.classList.remove('show');
            }

            window.addEventListener('load', function() {
                console.log('Page loaded successfully!');
            });
        </script>
    </body>
    </html>
    """
    return render_string(html_content)

if __name__ == '__main__':
    app.run(debug=True)