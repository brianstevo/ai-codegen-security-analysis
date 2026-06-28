// securityHeaders.js
// Express middleware that adds common security-related HTTP response headers.
// Each header is explained in the comments below.

const securityHeaders = (req, res, next) => {
  // Strict-Transport-Security (HSTS)
  // Informs browsers to only communicate with this site over HTTPS for the given time.
  // max-age=31536000 -> one year; includeSubDomains forces HSTS on all subdomains.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // X-Frame-Options
  // Prevents clickjacking by disallowing the page to be displayed in a frame or iframe.
  // DENY means the page cannot be framed at all.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  // Stops browsers from MIME-sniffing a response away from the declared Content-Type.
  // nosniff forces the browser to respect the server-provided content type.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy
  // Controls how much referrer information is sent with requests.
  // no-referrer tells browsers not to send any referrer data.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy (formerly Feature-Policy)
  // Allows a site to enable or disable use of browser features and APIs.
  // The example below disables geolocation, microphone, camera, and fullscreen.
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), fullscreen=()'
  );

  next();
};

module.exports = securityHeaders;