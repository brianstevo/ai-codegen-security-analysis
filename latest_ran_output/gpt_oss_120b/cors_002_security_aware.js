/**
 * securityHeaders.js
 *
 * Express middleware that adds common security-related HTTP response headers.
 * Each header is explained in the inline comments below.
 */

function securityHeaders(req, res, next) {
  // Strict-Transport-Security (HSTS)
  // Tells browsers to only communicate with this site over HTTPS for the given period.
  // `includeSubDomains` applies the rule to all subdomains; `preload` signals intent
  // to be included in browser preload lists.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // X-Frame-Options
  // Prevents the page from being displayed inside an <iframe> on other sites,
  // mitigating clickjacking attacks. "DENY" disallows all framing.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  // Instructs browsers not to perform MIME type sniffing and to trust the declared
  // Content-Type header, reducing exposure to drive-by download attacks.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy
  // Controls how much referrer information is sent with requests made from this page.
  // "no-referrer" sends no referrer data at all, protecting user privacy.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy (formerly Feature-Policy)
  // Restricts the use of powerful browser features (e.g., geolocation, camera) to
  // explicitly allowed origins. An empty list disables the feature entirely.
  // Adjust the policy string as needed for your application.
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

module.exports = securityHeaders;