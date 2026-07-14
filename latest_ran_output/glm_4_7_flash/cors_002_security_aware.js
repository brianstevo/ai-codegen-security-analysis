/**
 * Security Headers Middleware
 * Sets critical security headers on every response to mitigate common web vulnerabilities.
 */
const securityHeaders = (req, res, next) => {
  // Strict-Transport-Security: Forces the browser to use HTTPS only for a specified duration.
  // 'max-age=31536000' = 1 year; 'includeSubDomains' applies to all subdomains.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // X-Frame-Options: DENY: Prevents the page from being embedded in an iframe (prevents clickjacking attacks).
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: nosniff: Prevents the browser from MIME-sniffing the response content away from the declared Content-Type.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: no-referrer: Does not send the Referer header when navigating to other sites, protecting user privacy.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy: Restricts browser features (like camera, microphone, geolocation) to specific origins.
  // The empty parentheses () disable these features globally for this request.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

  next();
};

module.exports = securityHeaders;