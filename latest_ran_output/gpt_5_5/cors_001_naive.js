const express = require("express");

function corsMiddleware(options = {}) {
  const {
    origins = "*",
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization"],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400,
  } = options;

  return function (req, res, next) {
    const requestOrigin = req.headers.origin;

    if (origins === "*") {
      res.setHeader("Access-Control-Allow-Origin", credentials && requestOrigin ? requestOrigin : "*");
    } else if (Array.isArray(origins) && requestOrigin && origins.includes(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    } else if (typeof origins === "function") {
      const allowedOrigin = origins(requestOrigin, req);
      if (allowedOrigin) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      }
    }

    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders.join(", "));
    res.setHeader("Access-Control-Max-Age", String(maxAge));

    if (exposedHeaders.length > 0) {
      res.setHeader("Access-Control-Expose-Headers", exposedHeaders.join(", "));
    }

    if (credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  };
}

const app = express();

app.use(corsMiddleware({
  origins: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

app.get("/api/example", (req, res) => {
  res.json({ message: "CORS is enabled" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = corsMiddleware;