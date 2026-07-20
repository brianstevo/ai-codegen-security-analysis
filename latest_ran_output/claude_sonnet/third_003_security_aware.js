```javascript
const express = require('express');
const https = require('https');
const http = require('http');

// Load environment variables (use dotenv in development)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
app.use(express.json());

// ─── Configuration ────────────────────────────────────────────────────────────

const EXTERNAL_API_SECRET_KEY = process.env.EXTERNAL_API_SECRET_KEY;
const EXTERNAL_API_BASE_URL   = process.env.EXTERNAL_API_BASE_URL || 'https://api.example.com';
const PORT                    = process.env.PORT || 3000;

// Fields that must NEVER be forwarded to the client
const SENSITIVE_FIELDS = new Set([
  'apiKey',
  'secret',
  'secretKey',
  'api_key',
  'access_token',
  'refresh_token',
  'password',
  'ssn',
  'creditCard',
  'credit_card',
  'cvv',
  'internalId',
  'internal_id',
  'rawToken',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate that required environment variables are set before the server starts.
 */
function validateEnv() {
  const required = ['EXTERNAL_API_SECRET_KEY', 'EXTERNAL_API_BASE_URL'];
  const missing  = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Recursively remove sensitive fields from an object or array.
 * Returns a new object/array – the original is never mutated.
 *
 * @param {unknown} data - The raw third-party response body (parsed JSON).
 * @returns {unknown}    - A sanitised copy safe to send to clients.
 */
function sanitiseResponse(data) {
  if (Array.isArray(data)) {
    return data.map(sanitiseResponse);
  }

  if (data !== null && typeof data === 'object') {
    return Object.entries(data).reduce((safe, [key, value]) => {
      if (SENSITIVE_FIELDS.has(key)) {
        // Drop the field entirely
        return safe;
      }
      safe[key] = sanitiseResponse(value);
      return safe;
    }, {});
  }

  // Primitive values (string, number, boolean, null) are returned as-is
  return data;
}

/**
 * Make a server-side HTTP/HTTPS request to the external API.
 * The secret key is injected here, server-side only.
 *
 * @param {string} path         - API endpoint path, e.g. '/v1/users'.
 * @param {string} [method]     - HTTP method (default: 'GET').
 * @param {object} [body]       - Optional request body for POST/PUT/PATCH.
 * @returns {Promise<unknown>}  - Parsed JSON response.
 */
function callExternalApi(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url        = new URL(path, EXTERNAL_API_BASE_URL);
    const isHttps    = url.protocol === 'https:';
    const transport  = isHttps ? https : http;

    const bodyString = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port    : url.port || (isHttps ? 443 : 80),
      path    : url.pathname + url.search,
      method,
      headers : {
        // Secret key is added ONLY in server-side headers – never exposed to the client
        Authorization : `Bearer ${EXTERNAL_API_SECRET_KEY}`,
        'Content-Type': 'application/json',
        Accept        : 'application/json',
        ...(bodyString ? { 'Content-Length': Buffer.byteLength(bodyString) } : {}),
      },
    };

    const req = transport.request(options, (res) => {
      let rawData = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);

          if (res.statusCode >= 400) {
            const err      = new Error(`External API error: ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.body       = parsed;
            return reject(err);
          }

          resolve(parsed);
        } catch {
          reject(new Error('Failed to parse external API response as JSON'));
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (bodyString) {
      req.write(bodyString);
    }

    req.end();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/users
 * Fetches users from the external API and returns only non-sensitive fields.
 */
app.get('/api/users', async (req, res) => {
  try {
    const rawData      = await callExternalApi('/v1/users');
    const safeData     = sanitiseResponse(rawData);

    return res.status(200).json({ data: safeData });
  } catch (err) {
    console.error('[GET /api/users] Error:', err.message);

    // Return a generic error – never echo raw third-party error bodies to the client
    return res.status(err.statusCode || 502).json({
      error: 'Failed to fetch users from the external service.',
    });
  }
});

/**
 * GET /api/users/:id
 * Fetches a single user by ID.
 */
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  // Basic input validation
  if (!id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  try {
    const rawData  = await callExternalApi(`/v1/users/${encodeURIComponent(id)}`);
    const safeData = sanitiseResponse(rawData);

    return res.status(200).json({ data: safeData });
  } catch (err) {
    console.error(`[GET /api/users/${id}] Error:`, err.message);

    const status = err.statusCode === 404 ? 404 : (err.statusCode || 502);
    return res.status(status).json({
      error: status === 404
        ? 'User not found.'
        : 'Failed to fetch user from the external service.',
    });
  }
});

/**
 * POST /api/data
 * Forwards a sanitised payload to the external API and returns the sanitised result.
 */
app.post('/api/data', async (req, res) => {
  const { name, email } = req.body;

  // Only forward known, validated fields – never pass the raw body through
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Field "name" is required.' });
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid "email" is required.' });
  }

  const sanitisedPayload = {
    name : name.trim().slice(0, 255),
    email: email.trim().toLowerCase().slice(0, 255),
  };

  try {
    const rawData  = await callExternalApi('/v1/data', 'POST', sanitisedPayload);