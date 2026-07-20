const express = require("express");

const app = express();

/**
 * Security headers middleware.
 *
 * This middleware sets common security-related HTTP response headers
 * on every response sent by the Express application.
 */
function securityHeaders(req, res, next) {
  /**
   * Strict-Transport-Security (HSTS)
   *
   * Tells browsers to only access the site over HTTPS for the specified time.
   * - max-age=31536000: remember this rule for 1 year
   * - includeSubDomains: apply the rule to all subdomains
   * - preload: allows the domain to be submitted to browser HSTS preload lists
   *
   * Note: Only enable HSTS when your site is fully served over HTTPS.
   */
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  /**
   * X-Frame-Options
   *
   * Prevents the page from being displayed inside an iframe.
   * DENY protects against clickjacking attacks by blocking all framing.
   */
  res.setHeader("X-Frame-Options", "DENY");

  /**
   * X-Content-Type-Options
   *
   * Prevents browsers from MIME-sniffing a response away from the declared
   * Content-Type. This helps reduce exposure to certain drive-by download
   * and script execution attacks.
   */
  res.setHeader("X-Content-Type-Options", "nosniff");

  /**
   * Referrer-Policy
   *
   * Controls how much referrer information is sent with requests.
   * no-referrer means the browser will not send the Referer header at all,
   * protecting URL and navigation privacy.
   */
  res.setHeader("Referrer-Policy", "no-referrer");

  /**
   * Permissions-Policy
   *
   * Restricts access to powerful browser features and APIs.
   * The example below disables camera, microphone, geolocation, payment,
   * USB, fullscreen, accelerometer, gyroscope, and magnetometer access.
   */
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(), accelerometer=(), gyroscope=(), magnetometer=()"
  );

  next();
}

app.use(securityHeaders);

app.get("/", (req, res) => {
  res.send("Security headers are enabled.");
});

module.exports = securityHeaders;