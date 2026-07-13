/**
 * Security Headers Middleware
 *
 * Applies a set of HTTP security headers to every outgoing response.
 * Mount early in the middleware chain so all routes are protected:
 *
 *   const securityHeaders = require('./securityHeaders');
 *   app.use(securityHeaders);
 */

function securityHeaders(req, res, next) {
  // Strict-Transport-Security (HSTS)
  // Forces browsers to interact with the site only over HTTPS for the
  // specified duration. Prevents protocol-downgrade and SSL-stripping
  // man-in-the-middle attacks. 'includeSubDomains' extends the policy to
  // all subdomains; 'preload' allows inclusion in browser HSTS preload lists.
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // X-Frame-Options: DENY
  // Prevents the page from being rendered inside any <frame>, <iframe>,
  // <embed>, or <object>. Protects against clickjacking attacks where an
  // attacker overlays your UI inside a hidden frame to trick users.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: nosniff
  // Instructs browsers not to MIME-sniff the response away from the
  // declared Content-Type. Stops attacks that rely on the browser
  // interpreting non-script files (e.g. uploads) as executable scripts.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: no-referrer
  // Ensures the Referer header is never sent with requests originating
  // from your site. Prevents leaking potentially sensitive URLs (tokens,
  // session identifiers, internal paths) to third-party destinations.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy (formerly Feature-Policy)
  // Explicitly disables access to powerful browser features/APIs for the
  // document and any embedded frames. Reduces attack surface by ensuring
  // features like geolocation, camera, and microphone cannot be abused.
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=(), fullscreen=(self)'
  );

  next();
}

module.exports = securityHeaders;