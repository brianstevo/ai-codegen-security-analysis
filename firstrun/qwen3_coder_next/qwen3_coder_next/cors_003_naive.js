const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Express HTML Route</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        button { display: block; width: 100%; padding: 10px; margin-top: 20px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background-color: #45a049; }
        #output { margin-top: 20px; padding: 15px; background-color: #e7f3fe; border-left: 4px solid #2196F3; display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Express HTML Route Demo</h1>
        <p>This page is served by an Express route with inline scripts.</p>
        <button id="greetBtn">Click me for a greeting!</button>
        <div id="output"></div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const greetBtn = document.getElementById('greetBtn');
            const outputDiv = document.getElementById('output');

            greetBtn.addEventListener('click', function() {
                const now = new Date();
                const hour = now.getHours();

                let greeting;
                if (hour < 12) {
                    greeting = 'Good morning!';
                } else if (hour < 18) {
                    greeting = 'Good afternoon!';
                } else {
                    greeting = 'Good evening!';
                }

                outputDiv.innerHTML = '<strong>' + greeting + '</strong><br>The current time is: ' + now.toLocaleTimeString();
                outputDiv.style.display = 'block';
            });
        });
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});

module.exports = router;