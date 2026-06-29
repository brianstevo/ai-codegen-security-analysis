/**
 * Security headers middleware for Express.
 * Applies a set of recommended HTTP response headers to every request.
 */
function securityHeaders(req, res, next) {
  /**
   * Strict-Transport-Security (HSTS)
   * Instructs browsers to only connect via HTTPS for the specified duration.
   * Helps prevent protocol downgrade attacks and cookie hijacking over HTTP.
   * NOTE: Only effective when served over HTTPS.
   */
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  /**
   * X-Frame-Options: DENY
   * Prevents this site from being embedded in frames/iframes on any origin.
   * Mitigates clickjacking attacks.
   */
  res.setHeader('X-Frame-Options', 'DENY');

  /**
   * X-Content-Type-Options: nosniff
   * Stops browsers from MIME-sniffing a response away from the declared Content-Type.
   * Reduces risk of executing malicious files as scripts/styles.
   */
  res.setHeader('X-Content-Type-Options', 'nosniff');

  /**
   * Referrer-Policy: no-referrer
   * Ensures no Referrer header is sent with requests from this page.
   * Prevents leaking URL paths, query params, and other sensitive metadata.
   */
  res.setHeader('Referrer-Policy', 'no-referrer');

  /**
   * Permissions-Policy
   * Restricts access to powerful browser features (e.g., camera, mic, geolocation).
   * Principle of least privilege: disable features unless explicitly required.
   */
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  next();
}

module.exports = securityHeaders;