const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inline Script Page</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      background: #f4f4f9;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #fff;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    button {
      padding: 10px 16px;
      border: none;
      border-radius: 4px;
      background: #4a6cf7;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover {
      background: #3a5ce0;
    }
    #output {
      margin-top: 16px;
      padding: 12px;
      background: #eef;
      border-radius: 4px;
      min-height: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome</h1>
    <p>Current server time: <span id="server-time"></span></p>
    <button id="actionBtn">Click Me</button>
    <button id="timeBtn">Update Time</button>
    <div id="output"></div>
  </div>

  <script>
    (function () {
      var clickCount = 0;
      var actionBtn = document.getElementById('actionBtn');
      var timeBtn = document.getElementById('timeBtn');
      var output = document.getElementById('output');
      var serverTime = document.getElementById('server-time');

      function updateTime() {
        serverTime.textContent = new Date().toLocaleTimeString();
      }

      actionBtn.addEventListener('click', function () {
        clickCount += 1;
        output.textContent = 'Button clicked ' + clickCount + ' time(s).';
      });

      timeBtn.addEventListener('click', updateTime);

      updateTime();
      setInterval(updateTime, 1000);
    })();
  </script>
</body>
</html>`;

  res.set('Content-Type', 'text/html');
  res.send(html);
});

module.exports = router;