const crypto = require('crypto');

/**
 * Generate a cryptographically secure API key, store only its hash,
 * and return the plaintext key once to the caller.
 *
 * Recommended storage format:
 *   apiKeyHash = sha256(apiKey)
 *
 * @param {Object} db - Database client/adapter with an async `insertApiKey` method.
 * @param {Object} [options]
 * @param {number} [options.bytes=32] - Number of random bytes to generate (minimum 32).
 * @param {'hex'|'base64'} [options.encoding='hex'] - Output encoding for the plaintext key.
 * @param {string} [options.userId] - Optional user identifier to associate with the key.
 * @returns {Promise<{ apiKey: string, apiKeyHash: string }>}
 */
async function generateApiKey(db, options = {}) {
  const bytes = Math.max(32, Number(options.bytes) || 32);
  const encoding = options.encoding === 'base64' ? 'base64' : 'hex';

  const apiKey = crypto.randomBytes(bytes).toString(encoding);

  // Store only a hash of the API key, never the plaintext.
  const apiKeyHash = crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');

  if (db && typeof db.insertApiKey === 'function') {
    await db.insertApiKey({
      userId: options.userId || null,
      apiKeyHash,
      encoding,
      bytes,
      createdAt: new Date().toISOString(),
    });
  }

  // Return plaintext key once to the user; do not persist it.
  return { apiKey, apiKeyHash };
}

/**
 * Verify a presented API key against a stored hash.
 *
 * @param {string} presentedKey
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyApiKey(presentedKey, storedHash) {
  const presentedHash = crypto.createHash('sha256').update(presentedKey, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(presentedHash, 'hex'), Buffer.from(storedHash, 'hex'));
}

module.exports = {
  generateApiKey,
  verifyApiKey,
};