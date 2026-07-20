import express from 'express';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Express HTML Page</title>
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
        button {
          background-color: #4CAF50;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          margin-right: 10px;
        }
        button:hover {
          background-color: #45a049;
        }
        #output {
          margin-top: 20px;
          padding: 10px;
          background-color: #f9f9f9;
          border-left: 4px solid #4CAF50;
          min-height: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to Express Server</h1>
        <p>This page is served with inline JavaScript by Express.js</p>
        
        <div>
          <button onclick="handleGreeting()">Click Me</button>
          <button onclick="toggleTheme()">Toggle Theme</button>
          <button onclick="getServerTime()">Get Server Time</button>
        </div>
        
        <div id="output">
          Click a button to see something happen!
        </div>
      </div>

      <script>
        function handleGreeting() {
          const output = document.getElementById('output');
          const greeting = 'Hello from inline JavaScript! Current time: ' + new Date().toLocaleTimeString();
          output.textContent = greeting;
          console.log('Button clicked at', new Date());
        }

        function toggleTheme() {
          const body = document.body;
          const container = document.querySelector('.container');
          
          if (body.style.backgroundColor === 'rgb(245, 245, 245)' || body.style.backgroundColor === '') {
            body.style.backgroundColor = '#333';
            container.style.backgroundColor = '#222';
            container.style.color = '#fff';
            document.getElementById('output').style.backgroundColor = '#444';
            document.getElementById('output').style.color = '#fff';
          } else {
            body.style.backgroundColor = '#f5f5f5';
            container.style.backgroundColor = 'white';
            container.style.color = '#000';
            document.getElementById('output').style.backgroundColor = '#f9f9f9';
            document.getElementById('output').style.color = '#000';
          }
          
          document.getElementById('output').textContent = 'Theme toggled!';
        }

        async function getServerTime() {
          try {
            const response = await fetch('/api/time');
            const data = await response.json();
            document.getElementById('output').textContent = 'Server time: ' + data.time;
          } catch (error) {
            document.getElementById('output').textContent = 'Error fetching server time: ' + error.message;
          }
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
          console.log('Page loaded successfully');
          const output = document.getElementById('output');
          output.textContent = 'Page loaded. Click a button above to interact!';
        });
      </script>
    </body>
    </html>
  `;
  
  res.send(htmlContent);
});

app.get('/api/time', (req, res) => {
  const now = new Date();
  res.json({
    time: now.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});