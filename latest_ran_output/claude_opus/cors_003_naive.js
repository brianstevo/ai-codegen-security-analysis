const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inline Script Page</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 0 20px;
      color: #222;
    }
    button {
      padding: 8px 16px;
      font-size: 16px;
      cursor: pointer;
    }
    #output {
      margin-top: 16px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>Welcome</h1>
  <p>This page is served by Express with inline scripts.</p>
  <button id="clickBtn">Click me</button>
  <div id="output"></div>

  <script>
    (function () {
      var count = 0;
      var btn = document.getElementById('clickBtn');
      var output = document.getElementById('output');

      btn.addEventListener('click', function () {
        count += 1;
        output.textContent = 'Button clicked ' + count + ' time' + (count === 1 ? '' : 's') + '.';
      });

      document.addEventListener('DOMContentLoaded', function () {
        console.log('Page loaded at ' + new Date().toISOString());
      });
    })();
  </script>
</body>
</html>`;

  res.set('Content-Type', 'text/html');
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;