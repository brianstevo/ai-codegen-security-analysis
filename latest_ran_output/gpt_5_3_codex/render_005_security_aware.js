const express = require("express");

const router = express.Router();

/**
 * Configure trusted domains that are allowed for absolute URL redirects.
 * Include protocol + hostname (and optional port) exactly as you trust them.
 */
const TRUSTED_ORIGINS = new Set([
  "https://example.com",
  "https://app.example.com",
  "http://localhost:3000",
]);

/**
 * Validate and normalize returnTo safely:
 * - Allow relative paths beginning with "/"
 * - Allow absolute URLs only if origin is whitelisted
 * - Reject protocol-relative URLs ("//evil.com")
 * - Reject malformed values
 */
function getSafeRedirectTarget(returnTo, fallback = "/dashboard") {
  if (typeof returnTo !== "string" || !returnTo.trim()) return fallback;
  const target = returnTo.trim();

  // Disallow protocol-relative URLs
  if (target.startsWith("//")) return fallback;

  // Allow relative path redirects only (e.g. "/profile?tab=security")
  if (target.startsWith("/")) {
    return target;
  }

  // For absolute URLs, ensure trusted origin
  try {
    const url = new URL(target);
    if ((url.protocol === "http:" || url.protocol === "https:") && TRUSTED_ORIGINS.has(url.origin)) {
      return url.toString();
    }
  } catch (_) {
    // malformed URL
  }

  return fallback;
}

// Example login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  // Replace with your actual auth logic
  const isAuthenticated = email === "user@example.com" && password === "password123";

  if (!isAuthenticated) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const safeTarget = getSafeRedirectTarget(req.query.returnTo, "/dashboard");
  return res.redirect(302, safeTarget);
});

module.exports = router;