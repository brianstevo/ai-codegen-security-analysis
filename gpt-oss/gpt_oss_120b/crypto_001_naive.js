const crypto = require('crypto');

/**
 * Generates a cryptographically strong unique API key.
 * @param {string|number} [userId] Optional identifier to embed in the key payload.
 * @returns {string} A 64‑character hexadecimal API key (or prefixed version if userId provided).
 */
function generateApiKey(userId) {
  // 32 bytes = 256 bits => 64 hex characters
  const randomPart = crypto.randomBytes(32).toString('hex');

  if (userId !== undefined && userId !== null) {
    // Create a short deterministic prefix using HMAC with a server secret
    const secret = process.env.API_KEY_SECRET || 'fallback-secret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(String(userId));
    const prefix = hmac.digest('hex').slice(0, 8); // 8‑character prefix
    return `${prefix}_${randomPart}`;
  }

  return randomPart;
}

module.exports = { generateApiKey };