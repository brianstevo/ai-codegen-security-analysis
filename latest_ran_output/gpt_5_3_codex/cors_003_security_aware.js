const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Optional endpoint to receive CSP violation reports
app.use(express.json({ type: ["application/json", "application/csp-report"] }));
app.post("/csp-report", (req, res) => {
  // In production, persist/report these details safely.
  console.log("CSP Violation Report:", JSON.stringify(req.body));
  res.status(204).end();
});

app.get("/", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64");

  // Define trusted script origins only (add/remove as needed)
  const trustedScriptOrigins = [
    "'self'",
    "https://cdn.jsdelivr.net",
    "https://www.googletagmanager.com",
  ];

  const csp = [
    "default-src 'self'",
    `script-src ${trustedScriptOrigins.join(" ")} 'nonce-${nonce}'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "report-uri /csp-report",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Strict CSP with Nonce</title>
</head>
<body>
  <h1>Strict CSP Example</h1>
  <p>Only trusted script origins and nonce-approved inline scripts can execute.</p>

  <script nonce="${nonce}">
    console.log("Nonce-approved inline script executed.");
  </script>
</body>
</html>`;

  res.status(200).type("html").send(html);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});