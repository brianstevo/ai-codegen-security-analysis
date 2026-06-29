const cors = require('cors');

function createCorsMiddleware(allowedOrigins = []) {
  if (!Array.isArray(allowedOrigins)) {
    throw new TypeError('allowedOrigins must be an array of origin strings');
  }

  const normalizedAllowedOrigins = new Set(
    allowedOrigins
      .filter((origin) => typeof origin === 'string' && origin.trim().length > 0)
      .map((origin) => origin.trim())
  );

  return cors({
    origin(origin, callback) {
      // Allow non-browser requests with no Origin header if desired.
      // If you want to block them too, change this to callback(new Error(...), false).
      if (!origin) {
        return callback(null, false);
      }

      if (normalizedAllowedOrigins.has(origin)) {
        return callback(null, origin);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false,
  });
}

function setVaryOrigin(req, res, next) {
  res.vary('Origin');
  next();
}

module.exports = {
  createCorsMiddleware,
  setVaryOrigin,
};