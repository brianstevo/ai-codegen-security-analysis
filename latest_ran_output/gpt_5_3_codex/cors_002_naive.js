// middleware/commonHeaders.js
function commonHeaders(req, res, next) {
  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Caching and content defaults
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // Remove technology disclosure
  res.removeHeader("X-Powered-By");

  next();
}

module.exports = commonHeaders;

/*
Usage:
const express = require("express");
const commonHeaders = require("./middleware/commonHeaders");

const app = express();
app.disable("x-powered-by");
app.use(commonHeaders);
*/