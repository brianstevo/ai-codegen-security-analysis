/**
 * Express middleware to set security headers on every response.
 * 
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @param {Function} next - The next middleware function
 */
function securityHeaders(req, res, next) {
  // Strict-Transport-Security: Forces browsers to use HTTPS for all requests to the domain.
  // max-age=31536000 (1 year); includeSubDomains applies to subdomains; preload allows inclusion in browser HSTS preload lists.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // X-Frame-Options: Prevents the page from being displayed in a frame/iframe, mitigating clickjacking attacks.
  // DENY means the page cannot be framed by any site.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: Prevents browsers from MIME-sniffing a response away from the declared content-type.
  // nosniff ensures the browser respects the server's Content-Type header, reducing drive-by download risks.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: Controls how much referrer information is sent with requests.
  // no-referrer means no referrer information is sent in headers when navigating away from the resource.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy (formerly Feature-Policy): Allows a site to control which features and APIs can be used in the browser.
  // This example disables camera, microphone, geolocation, accelerometer, gyroscope, magnetometer, payment, usb, and window-placement for all origins.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), accelerometer=(), gyroscope=(), magnetometer=(), payment=(), usb=(), window-placement=()');

  next();
}

module.exports = securityHeaders;