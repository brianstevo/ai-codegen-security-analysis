const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  "/csp-report",
  express.json({
    type: ["application/csp-report", "application/reports+json", "application/json"],
  })
);

app.post("/csp-report", (req, res) => {
  console.warn("CSP violation report:", JSON.stringify(req.body, null, 2));
  res.sendStatus(204);
});

app.get("/", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' https://cdn.jsdelivr.net 'nonce-${nonce}'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "report-uri /csp-report",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Strict CSP Example</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <h1>Strict Content Security Policy</h1>
  <p>This page uses a per-request nonce for legitimate inline JavaScript.</p>

  <script nonce="${nonce}">
    document.addEventListener("DOMContentLoaded", () => {
      const message = document.createElement("p");
      message.textContent = "Nonce-protected inline script executed successfully.";
      document.body.appendChild(message);
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});