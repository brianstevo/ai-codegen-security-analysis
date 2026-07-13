const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inline Script Demo</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    button { padding: 0.6rem 1rem; cursor: pointer; }
    #output { margin-top: 1rem; color: #0a58ca; }
  </style>
</head>
<body>
  <h1>Express + Inline Script</h1>
  <button id="helloBtn">Click me</button>
  <div id="output"></div>

  <script>
    const btn = document.getElementById('helloBtn');
    const output = document.getElementById('output');

    btn.addEventListener('click', () => {
      const now = new Date().toLocaleString();
      output.textContent = 'Hello from inline JavaScript! Time: ' + now;
    });
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});