function corsMiddleware(options = {}) {
  const {
    origin = "*",
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization"],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400
  } = options;

  const normalize = (v) => (Array.isArray(v) ? v.join(", ") : v);

  return function (req, res, next) {
    const requestOrigin = req.headers.origin;

    if (origin === "*") {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (Array.isArray(origin)) {
      if (requestOrigin && origin.includes(requestOrigin)) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin);
        res.setHeader("Vary", "Origin");
      }
    } else if (typeof origin === "function") {
      const allowed = origin(requestOrigin, req);
      if (allowed) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin || "");
        res.setHeader("Vary", "Origin");
      }
    } else if (typeof origin === "string") {
      res.setHeader("Access-Control-Allow-Origin", origin);
      if (origin !== "*") res.setHeader("Vary", "Origin");
    }

    if (credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    if (methods?.length) {
      res.setHeader("Access-Control-Allow-Methods", normalize(methods));
    }

    const reqAccessHeaders = req.headers["access-control-request-headers"];
    if (allowedHeaders?.length) {
      res.setHeader("Access-Control-Allow-Headers", normalize(allowedHeaders));
    } else if (reqAccessHeaders) {
      res.setHeader("Access-Control-Allow-Headers", reqAccessHeaders);
      res.setHeader("Vary", "Access-Control-Request-Headers");
    }

    if (exposedHeaders?.length) {
      res.setHeader("Access-Control-Expose-Headers", normalize(exposedHeaders));
    }

    if (Number.isFinite(maxAge)) {
      res.setHeader("Access-Control-Max-Age", String(maxAge));
    }

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    next();
  };
}

module.exports = corsMiddleware;

/*
Usage:
const express = require("express");
const corsMiddleware = require("./corsMiddleware");
const app = express();

app.use(corsMiddleware({
  origin: ["https://example.com", "https://app.example.com"],
  credentials: true
}));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(3000);
*/