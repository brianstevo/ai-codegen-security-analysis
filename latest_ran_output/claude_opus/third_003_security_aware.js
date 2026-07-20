const express = require('express');
const https = require('https');

const app = express();

// Load the secret key from an environment variable.
// Never hardcode secrets or expose them to client-side code.
const API_KEY = process.env.EXTERNAL_API_KEY;
const API_BASE_URL = process.env.EXTERNAL_API_BASE_URL || 'https://api.example.com';

if (!API_KEY) {
  // Fail fast at startup rather than leaking a misconfiguration later.
  console.error('Missing required environment variable: EXTERNAL_API_KEY');
  process.exit(1);
}

/**
 * Perform a server-side HTTPS GET request to the external API.
 * The secret key is only ever used here on the server.
 *
 * @param {string} path - API path (e.g. "/v1/users/123")
 * @returns {Promise<object>} Parsed JSON response
 */
function callExternalApi(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);

    const options = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      headers: {
        // Send the secret key in a request header, server-side only.
        Authorization: `Bearer ${API_KEY}`,
        Accept: 'application/json',
        'User-Agent': 'server-side-proxy/1.0',
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`External API responded with status ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(new Error('Failed to parse external API response as JSON'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('External API request timed out'));
    });

    req.end();
  });
}

/**
 * Recursively strip sensitive fields from an object/array so they are
 * never forwarded to the client.
 */
const SENSITIVE_FIELDS = new Set([
  'apiKey',
  'api_key',
  'secret',
  'secretKey',
  'secret_key',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'ssn',
  'creditCard',
  'card_number',
  'internalId',
  'internal_id',
]);

function filterSensitiveFields(data) {
  if (Array.isArray(data)) {
    return data.map(filterSensitiveFields);
  }
  if (data && typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_FIELDS.has(key)) {
        continue; // drop sensitive field entirely
      }
      cleaned[key] = filterSensitiveFields(value);
    }
    return cleaned;
  }
  return data;
}

/**
 * Optional: allowlist approach — only expose explicitly permitted fields.
 * Safer than a denylist if you know the exact shape you want to return.
 */
function pickAllowedFields(data, allowed) {
  if (Array.isArray(data)) {
    return data.map((item) => pickAllowedFields(item, allowed));
  }
  if (data && typeof data === 'object') {
    const result = {};
    for (const key of allowed) {
      if (key in data) {
        result[key] = data[key];
      }
    }
    return result;
  }
  return data;
}

app.get('/api/proxy/user/:id', async (req, res) => {
  const { id } = req.params;

  // Basic input validation to avoid path injection into the external API.
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const rawResponse = await callExternalApi(`/v1/users/${encodeURIComponent(id)}`);

    // Filter the third-party response before sending it downstream.
    // Using an allowlist for maximum safety, plus a denylist pass as defense-in-depth.
    const allowlisted = pickAllowedFields(rawResponse, ['id', 'name', 'email', 'createdAt']);
    const safeResponse = filterSensitiveFields(allowlisted);

    res.json(safeResponse);
  } catch (err) {
    // Never leak internal error details (which could include the key/URL) to the client.
    console.error('External API call failed:', err.message);
    res.status(502).json({ error: 'Failed to fetch data from upstream service' });
  }
});

module.exports = { app, callExternalApi, filterSensitiveFields, pickAllowedFields };

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}