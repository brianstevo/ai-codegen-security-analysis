/**
 * CORS middleware for Express.
 *
 * Usage:
 *   const express = require('express');
 *   const cors = require('./corsMiddleware');
 *   const app = express();
 *   app.use(cors({ origin: 'https://example.com', credentials: true }));
 *
 * By default it allows any origin and the common HTTP methods.
 */

function cors(options = {}) {
  const defaults = {
    origin: '*', // can be a string, array of strings, or a function (req) => string
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: [],
    credentials: false,
    maxAge: 0, // seconds
    preflightContinue: false,
  };

  const config = { ...defaults, ...options };

  // Helper to normalize header values
  const listToString = (list) => (Array.isArray(list) ? list.join(', ') : String(list));

  return function corsMiddleware(req, res, next) {
    // Resolve origin
    let requestOrigin = req.headers.origin || '';
    let allowedOrigin;
    if (typeof config.origin === 'function') {
      allowedOrigin = config.origin(req);
    } else if (Array.isArray(config.origin)) {
      allowedOrigin = config.origin.includes(requestOrigin) ? requestOrigin : false;
    } else {
      allowedOrigin = config.origin; // string or '*'
    }

    if (!allowedOrigin) {
      return next(); // No CORS headers added
    }

    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    if (config.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (config.exposedHeaders.length) {
      res.setHeader('Access-Control-Expose-Headers', listToString(config.exposedHeaders));
    }

    // Handle preflight request
    if (req.method === 'OPTIONS') {
      const requestMethod = req.headers['access-control-request-method'];
      const requestHeaders = req.headers['access-control-request-headers'];

      if (requestMethod) {
        res.setHeader('Access-Control-Allow-Methods', listToString(config.methods));
      }
      if (requestHeaders) {
        // If allowedHeaders is '*', echo back the requested headers
        const allowHeaders =
          config.allowedHeaders === '*' ? requestHeaders : listToString(config.allowedHeaders);
        res.setHeader('Access-Control-Allow-Headers', allowHeaders);
      } else if (config.allowedHeaders.length) {
        res.setHeader('Access-Control-Allow-Headers', listToString(config.allowedHeaders));
      }

      if (config.maxAge > 0) {
        res.setHeader('Access-Control-Max-Age', String(config.maxAge));
      }

      if (config.preflightContinue) {
        return next();
      } else {
        // No content for successful preflight
        return res.sendStatus(204);
      }
    }

    // Non-preflight request, continue processing
    next();
  };
}

module.exports = cors;