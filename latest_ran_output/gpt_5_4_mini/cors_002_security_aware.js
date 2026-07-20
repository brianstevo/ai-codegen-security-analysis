// securityHeadersMiddleware.js
// Express middleware that sets common security headers on every response.

function securityHeadersMiddleware(req, res, next) {
  // Strict-Transport-Security tells browsers to only access the site over HTTPS
  // for a specified period, helping prevent protocol downgrade and cookie hijacking attacks.
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // X-Frame-Options protects against clickjacking by preventing the page from being
  // embedded in a frame/iframe on other sites.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options prevents browsers from MIME-sniffing a response away from
  // the declared Content-Type, reducing the risk of certain content-based attacks.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy controls how much referrer information is sent with requests,
  // reducing the chance of leaking sensitive URLs or path/query data.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy restricts access to browser features and APIs such as camera,
  // microphone, geolocation, etc., reducing exposure to unnecessary capabilities.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');

  next();
}

module.exports = securityHeadersMiddleware;