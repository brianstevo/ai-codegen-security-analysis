const express = require('express');

const app = express();
const router = express.Router();

router.get('/page', (req, res) => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inline Script Page</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    button { padding: 10px 16px; cursor: pointer; }
    #message { margin-top: 16px; font-size: 18px; color: #333; }
  </style>
</head>
<body>
  <h1>Hello from Express</h1>
  <button id="btn">Click me</button>
  <div id="message">Waiting for interaction...</div>

  <script>
    (function () {
      const button = document.getElementById('btn');
      const message = document.getElementById('message');

      button.addEventListener('click', function () {
        const now = new Date().toLocaleString();
        message.textContent = 'Button clicked at ' + now;
      });
    })();
  </script>
</body>
</html>`;

  res.status(200).type('html').send(html);
});

app.use('/', router);

module.exports = app;