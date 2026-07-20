const express = require("express");

const app = express();

const TRUSTED_ORIGINS = new Set([
  "https://example.com",
  "https://app.example.com",
  "https://admin.example.com",
]);

function trustedCors(options = {}) {
  const {
    origins = TRUSTED_ORIGINS,
    credentials = true,
    allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization"],
    exposedHeaders = [],
    maxAge = 86400,
  } = options;

  return function corsMiddleware(req, res, next) {
    res.vary("Origin");

    const origin = req.headers.origin;

    if (!origin) {
      return next();
    }

    if (!origins.has(origin)) {
      if (req.method === "OPTIONS") {
        return res.status(403).json({ error: "CORS origin denied" });
      }

      return next();
    }

    res.setHeader("Access-Control-Allow-Origin", origin);

    if (credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    res.setHeader("Access-Control-Allow-Methods", allowedMethods.join(", "));
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders.join(", "));

    if (exposedHeaders.length > 0) {
      res.setHeader("Access-Control-Expose-Headers", exposedHeaders.join(", "));
    }

    if (maxAge) {
      res.setHeader("Access-Control-Max-Age", String(maxAge));
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  };
}

app.use(
  trustedCors({
    origins: TRUSTED_ORIGINS,
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/data", (req, res) => {
  res.json({ received: req.body });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});