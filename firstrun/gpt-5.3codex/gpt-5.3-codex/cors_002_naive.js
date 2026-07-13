// middleware/securityHeaders.js
function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Clickjacking protection
  res.setHeader("X-Frame-Options", "DENY");

  // Basic XSS protection for older browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "no-referrer");

  // Restrict browser features
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  );

  // HSTS (enable only when serving over HTTPS in production)
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  // Simple CSP (adjust as needed for your app)
  res.setHeader("Content-Security-Policy", "default-src 'self'");

  next();
}

module.exports = securityHeaders;

/*
Usage:
const express = require('express');
const securityHeaders = require('./middleware/securityHeaders');

const app = express();
app.use(securityHeaders);
*/