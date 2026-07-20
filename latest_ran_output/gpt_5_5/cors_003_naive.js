const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Express Inline Script Page</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 2rem;
      background: #f5f5f5;
      color: #222;
    }

    main {
      max-width: 700px;
      margin: 0 auto;
      background: #fff;
      padding: 2rem;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    button {
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 6px;
      background: #2563eb;
      color: white;
      cursor: pointer;
      font-size: 1rem;
    }

    button:hover {
      background: #1d4ed8;
    }

    #message {
      margin-top: 1rem;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <main>
    <h1>Hello from Express</h1>
    <p>This HTML page is served by an Express route and includes an inline script.</p>

    <button id="clickBtn">Click Me</button>
    <p id="message"></p>
  </main>

  <script>
    document.addEventListener("DOMContentLoaded", function () {
      const button = document.getElementById("clickBtn");
      const message = document.getElementById("message");

      button.addEventListener("click", function () {
        message.textContent = "Button clicked at " + new Date().toLocaleTimeString();
      });
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});