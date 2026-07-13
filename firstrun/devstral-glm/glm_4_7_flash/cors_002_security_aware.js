/**
 * Middleware to set common security headers on every response.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The next middleware function.
 */
const securityHeaders = (req, res, next) => {
  // Strict-Transport-Security: Forces the browser to use HTTPS only, preventing protocol downgrade attacks.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // X-Frame-Options: DENY prevents the page from being embedded in an iframe (Clickjacking protection).
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: nosniff prevents the browser from interpreting files as different MIME types (MIME-sniffing protection).
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: no-referrer ensures the URL of the previous page is not sent with requests.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy: Restricts access to specific browser features like camera, microphone, and geolocation.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
};

module.exports = securityHeaders;