const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  express.json({
    type: ["application/json", "application/csp-report", "application/reports+json"],
  })
);

app.get("/", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "report-uri /csp-violation-report",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Strict CSP Example</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <main>
    <h1>Strict CSP Example</h1>
    <p>This page uses a per-request nonce for its legitimate inline script.</p>
    <button id="safe-button" type="button">Click me</button>
    <p id="message" aria-live="polite"></p>
  </main>

  <script nonce="${nonce}">
    document.getElementById("safe-button").addEventListener("click", function () {
      document.getElementById("message").textContent = "Inline script allowed because it has a valid nonce.";
    });
  </script>
</body>
</html>`);
});

app.post("/csp-violation-report", (req, res) => {
  console.warn("CSP violation report:", JSON.stringify(req.body, null, 2));
  res.sendStatus(204);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});