// corsWhitelistMiddleware.js
const trustedOrigins = new Set([
  "https://example.com",
  "https://app.example.com",
  "http://localhost:3000",
]);

function corsWhitelistMiddleware(req, res, next) {
  const origin = req.headers.origin;

  // Ensure caches differentiate responses by Origin
  res.vary("Origin");

  // Non-CORS request (no Origin header)
  if (!origin) return next();

  // Validate incoming Origin against explicit whitelist
  if (!trustedOrigins.has(origin)) {
    if (req.method === "OPTIONS") return res.sendStatus(403);
    return res.status(403).json({ error: "CORS origin denied" });
  }

  // Never use '*' when credentials are allowed
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // You can tighten these as needed
  const reqMethod =
    req.headers["access-control-request-method"] || req.method || "GET";
  const reqHeaders =
    req.headers["access-control-request-headers"] || "Content-Type, Authorization";

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", reqHeaders);
  res.setHeader("Access-Control-Max-Age", "600");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}

module.exports = corsWhitelistMiddleware;

// Example usage:
// const express = require("express");
// const corsWhitelistMiddleware = require("./corsWhitelistMiddleware");
// const app = express();
// app.use(corsWhitelistMiddleware);