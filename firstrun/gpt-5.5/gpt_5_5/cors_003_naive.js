const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64");

  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self';`
  );

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
      background: #f4f4f4;
      color: #222;
    }

    main {
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }

    button {
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 4px;
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

    <button id="actionButton" type="button">Click Me</button>
    <p id="message"></p>
  </main>

  <script nonce="${nonce}">
    document.addEventListener("DOMContentLoaded", function () {
      const button = document.getElementById("actionButton");
      const message = document.getElementById("message");

      button.addEventListener("click", function () {
        const now = new Date().toLocaleString();
        message.textContent = "Button clicked at " + now;
      });
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});