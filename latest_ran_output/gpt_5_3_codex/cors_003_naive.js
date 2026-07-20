const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inline Script Page</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    button { padding: 0.6rem 1rem; cursor: pointer; }
    #output { margin-top: 1rem; color: #333; }
  </style>
</head>
<body>
  <h1>Hello from Express</h1>
  <p>This page is served by an Express route and includes inline JavaScript.</p>
  <button id="btn">Click me</button>
  <div id="output"></div>

  <script>
    (function () {
      const btn = document.getElementById('btn');
      const output = document.getElementById('output');

      btn.addEventListener('click', function () {
        const now = new Date();
        output.textContent = 'Button clicked at: ' + now.toLocaleString();
      });
    })();
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});