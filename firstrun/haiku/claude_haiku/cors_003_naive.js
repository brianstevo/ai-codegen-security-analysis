```javascript
import express from 'express';

const app = express();
const PORT = 3000;

// Route that serves an HTML page with inline scripts
app.get('/', (req, res) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Express HTML Page with Inline Scripts</title>
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
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
          color: #333;
        }
        button {
          background-color: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          margin: 10px 5px 10px 0;
        }
        button:hover {
          background-color: #0056b3;
        }
        #output {
          margin-top: 20px;
          padding: 15px;
          background-color: #f9f9f9;
          border-left: 4px solid #007bff;
          display: none;
        }
        .info {
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to Express with Inline JavaScript</h1>
        <p class="info">This page demonstrates serving HTML with inline JavaScript from an Express server.</p>
        
        <button onclick="handleClick()">Click Me</button>
        <button onclick="showDateTime()">Show Date & Time</button>
        <button onclick="clearOutput()">Clear Output</button>
        
        <div id="output"></div>
      </div>

      <script>
        // Inline JavaScript functions
        function handleClick() {
          const output = document.getElementById('output');
          output.style.display = 'block';
          output.innerHTML = '<strong>Button clicked!</strong><br>You successfully triggered a JavaScript function.';
        }

        function showDateTime() {
          const output = document.getElementById('output');
          const now = new Date();
          output.style.display = 'block';
          output.innerHTML = '<strong>Current Date & Time:</strong><br>' + now.toString();
        }

        function clearOutput() {
          const output = document.getElementById('output');
          output.style.display = 'none';
          output.innerHTML = '';
        }

        // Initialize message
        window.addEventListener('load', () => {
          console.log('Page loaded successfully!');
          const output = document.getElementById('output');
          output.style.display = 'block';
          output.innerHTML = 'Page loaded at ' + new Date().toLocaleTimeString() + '<br>Click the buttons above to interact with the page.';
        });

        // Add keyboard shortcuts
        document.addEventListener('keydown', (event) => {
          if (event.key === '1') handleClick();
          if (event.key === '2') showDateTime();
          if (event.key === 'Escape') clearOutput();
        });
      </script>
    </body>
    </html>
  `;

  res.send(htmlContent);
});

// Optional: Another route with different inline scripts
app.get('/calculator', (req, res) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Simple Calculator</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
        }
        .calculator {
          background-color: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          width: 300px;
        }
        h2 {
          text-align: center;
          color: #333;
        }
        input {
          width: 100%;
          padding: 10px;
          margin: 10px 0;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          box-sizing: border-box;
        }
        .button-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        button {
          padding: 12px;
          font-size: 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          background-color: #667eea;
          color: white;
          font-weight: bold;
        }
        button:hover {
          background-color: #764ba2;
        }
        button.clear {
          grid-column: 1 / -1;
          background-color: #e74c3c;
        }
        button.clear:hover {
          background-color: #c0392b;
        }
      </style>
    </head>
    <body>
      <div class="calculator">
        <h2>Calculator</h2>
        <input type="number" id="num1" placeholder="First number">
        <input type="number" id="num2" placeholder="Second number">
        <div class="button-group">
          <button onclick="calculate('add')">Add</button>
          <button onclick="calculate('subtract')">Subtract</button>
          <button onclick="calculate('multiply')">Multiply</button>
          <button onclick="calculate('divide')">Divide</button>
          <button class="clear" onclick="clearFields()">Clear</button>
        </div>
        <input type="text" id="result" placeholder="Result" readonly style="margin-top: 20px; background-color: #f0f0f0;">
      </div>

      <script>
        function calculate(operation) {
          const num1 = parseFloat(document.getElementById('num1').value);
          const num2 = parseFloat(document.getElementById('num2').value);
          const resultInput = document.getElementById('result');

          if (isNaN(num1) || isNaN(num2)) {
            resultInput.value = 'Enter valid numbers';
            return;
          }

          let result;
          switch(operation) {
            case 'add':
              result = num1 + num2;
              break;
            case 'subtract':
              result = num1 - num2;
              break;
            case 'multiply':
              result = num1 * num2;
              break;
            case 'divide':
              if (num2 === 0) {
                resultInput.value = 'Cannot divide by zero';
                return;
              }
              result = num1 / num2;
              break;
          }

          resultInput.value = result.toFixed(4);
        }

        function clearFields() {
          document.getElementById('num1').value = '';
          document.getElementById('num2').value = '';
          document.getElementById('result').value = '';
        }

        // Allow Enter key for calculation
        document.addEventListener('keypress', (event) => {
          if (event.key === 'Enter') {
            calculate('add');
          }
        });
      </script>