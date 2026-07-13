const express = require('express');
const https = require('https');

const router = express.Router();

// Load the secret key from an environment variable.
// Never hardcode it and never send it to the client.
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY;
const EXTERNAL_API_BASE_URL = process.env.EXTERNAL_API_BASE_URL || 'https://api.example.com';

if (!EXTERNAL_API_KEY) {
  // Fail fast at startup so we never run without proper configuration.
  console.error('Missing required environment variable: EXTERNAL_API_KEY');
  process.exit(1);
}

/**
 * Performs a server-side HTTPS GET request to the external API using the
 * secret key for authentication. Returns the parsed JSON response.
 *
 * @param {string} path - API path (e.g. "/v1/users/123").
 * @returns {Promise<object>} Parsed JSON response from the external API.
 */
function callExternalApi(path) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(path, EXTERNAL_API_BASE_URL);
    } catch (err) {
      return reject(new Error('Invalid API path'));
    }

    const options = {
      method: 'GET',
      headers: {
        // Secret key only ever leaves the server, never the browser.
        Authorization: `Bearer ${EXTERNAL_API_KEY}`,
        Accept: 'application/json',
      },
      timeout: 10000,
    };

    const req = https.request(url, options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`External API returned status ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(new Error('Failed to parse external API response'));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('External API request timed out'));
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

/**
 * Allow-list filter: only the explicitly named fields are exposed to clients.
 * This prevents leaking secrets, internal IDs, tokens, PII, or any unexpected
 * sensitive fields that the third party might include.
 *
 * @param {object} data - Raw response object from the external API.
 * @returns {object} A sanitized object containing only safe fields.
 */
function filterSensitiveFields(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const ALLOWED_FIELDS = ['id', 'name', 'displayName', 'status', 'createdAt'];

  const sanitized = {};
  for (const field of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      sanitized[field] = data[field];
    }
  }
  return sanitized;
}

// Example route: server-side only proxy that never forwards the raw response.
router.get('/resource/:id', async (req, res) => {
  const { id } = req.params;

  // Basic input validation to avoid injection into the upstream path.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid resource id' });
  }

  try {
    const rawResponse = await callExternalApi(`/v1/resources/${encodeURIComponent(id)}`);
    const safeResponse = filterSensitiveFields(rawResponse);
    return res.status(200).json(safeResponse);
  } catch (err) {
    // Log details server-side only; never expose internal error details
    // or the secret key to the client.
    console.error('External API call failed:', err.message);
    return res.status(502).json({ error: 'Failed to fetch resource' });
  }
});

module.exports = { router, callExternalApi, filterSensitiveFields };