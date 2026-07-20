const crypto = require('crypto');

/**
 * Generates a cryptographically secure API key.
 *
 * - Uses crypto.randomBytes for secure randomness (>= 32 bytes).
 * - Encodes the plaintext key as hex or base64url.
 * - Stores only a SHA-256 hash of the key (never the plaintext).
 * - Returns the plaintext key exactly once to the caller.
 *
 * @param {Object}   [options]
 * @param {number}   [options.byteLength=32]        Number of random bytes (>= 32).
 * @param {string}   [options.encoding='base64url'] 'hex' or 'base64url'.
 * @param {string}   [options.prefix='sk']          Optional key prefix.
 * @param {Function} [options.persist]              async fn({ keyId, keyHash, prefix, createdAt }) to store the hash.
 * @returns {Promise<{ apiKey: string, keyId: string, keyHash: string }>}
 */
async function generateApiKey(options = {}) {
  const {
    byteLength = 32,
    encoding = 'base64url',
    prefix = 'sk',
    persist,
  } = options;

  if (!Number.isInteger(byteLength) || byteLength < 32) {
    throw new Error('byteLength must be an integer >= 32');
  }
  if (!['hex', 'base64url', 'base64'].includes(encoding)) {
    throw new Error("encoding must be 'hex', 'base64url', or 'base64'");
  }

  // Secure random bytes for the secret portion of the key.
  const secretBytes = crypto.randomBytes(byteLength);
  const secret = secretBytes.toString(encoding);

  // A separate, non-secret identifier so keys can be looked up without
  // needing the plaintext (helps avoid full-table hash scans).
  const keyId = crypto.randomBytes(12).toString('hex');

  // Compose the plaintext key returned to the user (shown only once).
  const apiKey = prefix ? `${prefix}_${keyId}_${secret}` : `${keyId}_${secret}`;

  // Store only a hash of the full plaintext key.
  const keyHash = hashApiKey(apiKey);

  const record = {
    keyId,
    keyHash,
    prefix,
    createdAt: new Date(),
  };

  if (typeof persist === 'function') {
    await persist(record);
  }

  // Plaintext apiKey is returned once and must not be stored server-side.
  return { apiKey, keyId, keyHash };
}

/**
 * Deterministically hashes an API key for storage/lookup.
 * SHA-256 is appropriate here because the key is high-entropy random data.
 *
 * @param {string} apiKey
 * @returns {string} hex-encoded SHA-256 hash.
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of a presented key against a stored hash.
 *
 * @param {string} presentedKey  Plaintext key supplied by the client.
 * @param {string} storedHash    Hex SHA-256 hash from the database.
 * @returns {boolean}
 */
function verifyApiKey(presentedKey, storedHash) {
  if (typeof presentedKey !== 'string' || typeof storedHash !== 'string') {
    return false;
  }
  const presentedHash = hashApiKey(presentedKey);
  const a = Buffer.from(presentedHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
};