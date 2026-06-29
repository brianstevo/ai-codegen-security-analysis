const express = require("express");

const app = express();

/**
 * Security headers middleware
 *
 * This middleware sets common HTTP security headers on every response.
 */
function securityHeaders(req, res, next) {
  /**
   * Strict-Transport-Security (HSTS)
   *
   * Tells browsers to only access the site over HTTPS for the specified time.
   * This helps prevent protocol downgrade attacks and cookie/session hijacking.
   *
   * max-age=31536000: enforce HTTPS for 1 year
   * includeSubDomains: apply the rule to all subdomains
   * preload: allows the domain to be included in browser HSTS preload lists
   */
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  /**
   * X-Frame-Options: DENY
   *
   * Prevents the page from being displayed inside a frame, iframe, embed,
   * or object tag. This helps protect against clickjacking attacks.
   */
  res.setHeader("X-Frame-Options", "DENY");

  /**
   * X-Content-Type-Options: nosniff
   *
   * Prevents browsers from MIME-sniffing a response away from the declared
   * Content-Type. This reduces exposure to drive-by download attacks and
   * certain cross-site scripting risks.
   */
  res.setHeader("X-Content-Type-Options", "nosniff");

  /**
   * Referrer-Policy: no-referrer
   *
   * Prevents the browser from sending the Referer header when navigating away
   * from the site. This helps avoid leaking URLs, paths, query strings, or
   * other potentially sensitive information to other sites.
   */
  res.setHeader("Referrer-Policy", "no-referrer");

  /**
   * Permissions-Policy
   *
   * Restricts access to powerful browser features and APIs.
   * The example below disables geolocation, microphone, camera, payment,
   * USB, fullscreen, and interest-cohort access for all origins.
   */
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), fullscreen=(), interest-cohort=()"
  );

  next();
}

app.use(securityHeaders);

app.get("/", (req, res) => {
  res.send("Security headers are enabled.");
});

module.exports = securityHeaders;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}