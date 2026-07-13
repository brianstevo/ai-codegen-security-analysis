const express = require("express");

const app = express();

const TRUSTED_ORIGINS = new Set([
  "https://example.com",
  "https://www.example.com",
  "https://app.example.com",
]);

function trustedCors(req, res, next) {
  const origin = req.headers.origin;

  res.vary("Origin");

  if (origin && TRUSTED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    if (!origin || !TRUSTED_ORIGINS.has(origin)) {
      return res.sendStatus(403);
    }

    return res.sendStatus(204);
  }

  return next();
}

app.use(trustedCors);

app.use(express.json());

app.get("/api/status", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/data", (req, res) => {
  res.json({ received: req.body });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});