const crypto = require('crypto');

/**
 * Generates a cryptographically secure API key.
 *
 * - Uses crypto.randomBytes to create at least 32 bytes of entropy.
 * - Returns the plaintext key once (must be shown to the user immediately).
 * - Stores only a SHA-256 hash of the key for later verification.
 *
 * @param {Object} options
 * @param {number} [options.bytes=32]       Number of random bytes (>= 32).
 * @param {string} [options.encoding='base64url'] Output encoding: 'hex', 'base64', or 'base64url'.
 * @param {string} [options.prefix='sk']     Optional human-readable prefix.
 * @param {Function} [options.persist]        Async fn to store the record in DB. Receives the record.
 * @returns {Promise<{ apiKey: string, keyId: string, keyHash: string }>}
 */
async function generateApiKey(options = {}) {
  const {
    bytes = 32,
    encoding = 'base64url',
    prefix = 'sk',
    persist,
  } = options;

  if (!Number.isInteger(bytes) || bytes < 32) {
    throw new Error('Key length must be an integer of at least 32 bytes.');
  }

  const allowedEncodings = ['hex', 'base64', 'base64url'];
  if (!allowedEncodings.includes(encoding)) {
    throw new Error(`Encoding must be one of: ${allowedEncodings.join(', ')}.`);
  }

  // Generate cryptographically secure random bytes.
  const rawBytes = await new Promise((resolve, reject) => {
    crypto.randomBytes(bytes, (err, buf) => (err ? reject(err) : resolve(buf)));
  });

  // Encode the secret portion of the key.
  const secret = rawBytes.toString(encoding);

  // A non-secret identifier so a row can be looked up without revealing the key.
  const keyId = crypto.randomBytes(8).toString('hex');

  // Assemble the plaintext key returned to the user exactly once.
  const apiKey = `${prefix}_${keyId}_${secret}`;

  // Hash only the key for storage. SHA-256 is appropriate for high-entropy
  // random tokens (no salting/slow hashing needed since the input is not guessable).
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const record = {
    keyId,
    keyHash,
    prefix,
    createdAt: new Date().toISOString(),
  };

  // Persist only the hash (never the plaintext) if a storage function is provided.
  if (typeof persist === 'function') {
    await persist(record);
  }

  // Return plaintext key once; caller is responsible for showing it to the user
  // and discarding it. Only keyId/keyHash should ever be stored.
  return { apiKey, keyId, keyHash };
}

/**
 * Verifies a presented API key against a stored hash using a timing-safe compare.
 *
 * @param {string} presentedKey  The plaintext key supplied by the client.
 * @param {string} storedHash    The hex SHA-256 hash from the database.
 * @returns {boolean}
 */
function verifyApiKey(presentedKey, storedHash) {
  if (typeof presentedKey !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const computedHash = crypto.createHash('sha256').update(presentedKey).digest('hex');
  const a = Buffer.from(computedHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

module.exports = { generateApiKey, verifyApiKey };