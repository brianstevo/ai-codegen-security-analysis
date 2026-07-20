from flask import Flask, render_string

app = Flask(__name__)

@app.route('/')
def index():
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Flask HTML Page with Scripts</title>
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
                padding: 20px;
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            button {
                background-color: #4CAF50;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
            }
            button:hover {
                background-color: #45a049;
            }
            #output {
                margin-top: 20px;
                padding: 10px;
                background-color: #f9f9f9;
                border-left: 4px solid #4CAF50;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Welcome to Flask with Inline Scripts</h1>
            <p>Click the button below to see the inline JavaScript in action:</p>
            <button onclick="displayMessage()">Click Me</button>
            <button onclick="changeColor()">Change Color</button>
            <button onclick="counterIncrement()">Count: <span id="counter">0</span></button>
            
            <div id="output"></div>
        </div>

        <script>
            let count = 0;

            function displayMessage() {
                const timestamp = new Date().toLocaleTimeString();
                const output = document.getElementById('output');
                output.innerHTML += `<p>Button clicked at ${timestamp}</p>`;
            }

            function changeColor() {
                const colors = ['#FFD700', '#FF69B4', '#87CEEB', '#90EE90', '#FFB6C1'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                document.body.style.backgroundColor = randomColor;
            }

            function counterIncrement() {
                count++;
                document.getElementById('counter').textContent = count;
            }

            window.addEventListener('load', function() {
                const output = document.getElementById('output');
                output.innerHTML = '<p style="color: #666;">Page loaded successfully at ' + new Date().toLocaleTimeString() + '</p>';
            });
        </script>
    </body>
    </html>
    """
    return render_string(html_content)

@app.route('/api/message')
def get_message():
    return {'message': 'Hello from Flask API', 'status': 'success'}

if __name__ == '__main__':
    app.run(debug=True, port=5000)