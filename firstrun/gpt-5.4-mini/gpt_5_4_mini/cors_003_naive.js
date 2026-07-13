const express = require('express');

const app = express();
const router = express.Router();

router.get('/page', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inline Script Page</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; }
    button { padding: 10px 16px; cursor: pointer; }
    #output { margin-top: 16px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Express Served HTML Page</h1>
  <p>This page includes inline JavaScript.</p>
  <button id="btn">Click me</button>
  <div id="output">Waiting for interaction...</div>

  <script>
    (function () {
      const btn = document.getElementById('btn');
      const output = document.getElementById('output');

      btn.addEventListener('click', function () {
        output.textContent = 'Button clicked at ' + new Date().toLocaleString();
      });
    })();
  </script>
</body>
</html>`);
});

app.use('/', router);

module.exports = app;