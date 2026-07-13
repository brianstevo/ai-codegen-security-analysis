const express = require("express");

function commonHeaders(options = {}) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Cache-Control": "no-store",
    ...options.headers,
  };

  return function commonHeadersMiddleware(req, res, next) {
    Object.entries(headers).forEach(([name, value]) => {
      if (value !== undefined && value !== null) {
        res.setHeader(name, value);
      }
    });

    next();
  };
}

const app = express();

app.disable("x-powered-by");

app.use(commonHeaders());

app.get("/", (req, res) => {
  res.json({ message: "Common HTTP headers added to this response." });
});

module.exports = {
  commonHeaders,
  app,
};