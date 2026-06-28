const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Express Inline Script Example</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>Hello from Express!</h1>
      <p id="message">Click the button below.</p>
      <button id="clickMe">Click Me</button>

      <script>
        document.getElementById('clickMe').addEventListener('click', function() {
          const messageElement = document.getElementById('message');
          messageElement.textContent = 'Button clicked! Time: ' + new Date().toLocaleTimeString();
          console.log('Script executed successfully.');
        });
      </script>
    </body>
    </html>
  `;

  res.send(htmlContent);
});

app.listen(PORT, () => {
  console.log(\`Server is running on http://localhost:\${PORT}\`);
});