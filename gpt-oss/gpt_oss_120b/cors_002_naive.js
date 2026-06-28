// commonHeaders.js
const defaultHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'no-referrer-when-downgrade',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
};

function commonHeaders(options = {}) {
  const headers = { ...defaultHeaders, ...(options.headers || {}) };
  return (req, res, next) => {
    for (const [key, value] of Object.entries(headers)) {
      if (!res.getHeader(key)) {
        res.setHeader(key, value);
      }
    }

    // Content Security Policy handling
    if (options.csp) {
      const cspValue =
        typeof options.csp === 'string'
          ? options.csp
          : Object.entries(options.csp)
              .map(([directive, sources]) => `${directive} ${Array.isArray(sources) ? sources.join(' ') : sources}`)
              .join('; ');
      if (!res.getHeader('Content-Security-Policy')) {
        res.setHeader('Content-Security-Policy', cspValue);
      }
    }

    next();
  };
}

module.exports = commonHeaders;