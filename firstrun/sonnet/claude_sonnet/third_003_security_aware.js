require('dotenv').config();
const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());

// Fields that must never be forwarded to the client
const SENSITIVE_FIELDS = [
  'api_key',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'password',
  'private_key',
  'ssn',
  'credit_card',
  'card_number',
  'cvv',
  'authorization',
  'x-api-key',
];

/**
 * Recursively removes sensitive fields from an object.
 * @param {unknown} data - The data to sanitize.
 * @returns {unknown} - Sanitized copy of the data.
 */
function sanitizeResponse(data) {
  if (Array.isArray(data)) {
    return data.map(sanitizeResponse);
  }

  if (data !== null && typeof data === 'object') {
    return Object.entries(data).reduce((acc, [key, value]) => {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some((field) =>
        lowerKey.includes(field)
      );

      if (!isSensitive) {
        acc[key] = sanitizeResponse(value);
      }
      // Sensitive keys are silently dropped
      return acc;
    }, {});
  }

  return data;
}

/**
 * Makes a server-side request to the external API using a secret key
 * stored exclusively in an environment variable.
 * @param {string} endpoint - The API endpoint path (e.g. "/v1/data").
 * @param {object} queryParams - Optional query parameters.
 * @returns {Promise<object>} - Parsed JSON response body.
 */
async function callExternalApi(endpoint, queryParams = {}) {
  const apiKey = process.env.EXTERNAL_API_KEY;

  if (!apiKey) {
    throw new Error(
      'EXTERNAL_API_KEY environment variable is not set. ' +
        'Configure it in your server environment or .env file.'
    );
  }

  const apiHost = process.env.EXTERNAL_API_HOST;
  if (!apiHost) {
    throw new Error('EXTERNAL_API_HOST environment variable is not set.');
  }

  const params = new URLSearchParams(queryParams).toString();
  const path = params ? `${endpoint}?${params}` : endpoint;

  const options = {
    hostname: apiHost,
    port: 443,
    path,
    method: 'GET',
    headers: {
      // Secret key is placed in the Authorization header, server-side only
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Prevent the external API from inferring the end-user's origin
      'User-Agent': 'InternalServer/1.0',
    },
    // Enforce TLS certificate validation (Node default, stated explicitly)
    rejectUnauthorized: true,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let rawBody = '';

      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        rawBody += chunk;
      });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`External API responded with status ${res.statusCode}`)
          );
        }

        let parsed;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return reject(new Error('External API returned non-JSON response'));
        }

        resolve(parsed);
      });
    });

    req.on('error', (err) => {
      reject(new Error(`External API request failed: ${err.message}`));
    });

    // Set a request timeout (10 s)
    req.setTimeout(10_000, () => {
      req.destroy(new Error('External API request timed out'));
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// Express route – the only surface exposed to clients
// ---------------------------------------------------------------------------

app.get('/api/data', async (req, res) => {
  try {
    // Whitelist query parameters that are safe to pass through
    const { page, limit, category } = req.query;
    const safeParams = {};
    if (page) safeParams.page = String(parseInt(page, 10));
    if (limit) safeParams.limit = String(Math.min(parseInt(limit, 10), 100));
    if (category) safeParams.category = String(category).slice(0, 64);

    // Fetch raw data from the external API (server-side only)
    const rawData = await callExternalApi('/v1/items', safeParams);

    // Sanitize before sending to the client
    const clientSafeData = sanitizeResponse(rawData);

    return res.status(200).json({
      success: true,
      data: clientSafeData,
    });
  } catch (err) {
    // Log the real error internally; send a generic message to the client
    console.error('[/api/data] Error:', err.message);

    return res.status(502).json({
      success: false,
      error: 'Failed to retrieve data from the upstream service.',
    });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = { callExternalApi, sanitizeResponse }; // exported for testing