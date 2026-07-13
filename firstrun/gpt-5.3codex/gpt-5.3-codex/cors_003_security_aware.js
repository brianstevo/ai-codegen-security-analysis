const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// CSP violation reporting endpoint
app.post("/csp-report", (req, res) => {
  // In production, persist/report this securely
  console.log("CSP Violation Report:", JSON.stringify(req.body, null, 2));
  res.status(204).end();
});

app.get("/", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://www.googletagmanager.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "style-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "report-uri /csp-report"
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Strict CSP with Nonce</title>
</head>
<body>
  <h1>Strict CSP Demo</h1>
  <p>If CSP is configured correctly, only trusted scripts and nonce-bearing inline scripts run.</p>

  <script nonce="${nonce}">
    (function () {
      const p = document.createElement('p');
      p.textContent = 'Inline script executed with valid nonce.';
      document.body.appendChild(p);
    })();
  </script>

  <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js" defer></script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});