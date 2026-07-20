const crypto = require('crypto');

/**
 * Generate a cryptographically secure API key, store only its hash, and return the plaintext once.
 *
 * Usage:
 *   const result = generateApiKey();
 *   // result.plaintextKey -> show to user once
 *   // result.hashedKey    -> store in DB
 */
function generateApiKey(options = {}) {
  const {
    bytes = 32, // 32 bytes = 256 bits minimum recommended
    encoding = 'hex', // 'hex' or 'base64'
    hashAlgorithm = 'sha256',
    hashSalt = crypto.randomBytes(16).toString('hex'), // per-key salt
  } = options;

  if (!Number.isInteger(bytes) || bytes < 32) {
    throw new Error('API key must be at least 32 bytes.');
  }

  if (!['hex', 'base64'].includes(encoding)) {
    throw new Error("Encoding must be either 'hex' or 'base64'.");
  }

  const plaintextKey = crypto.randomBytes(bytes).toString(encoding);

  // Store only a hash, never the plaintext key
  // Include salt so identical keys do not produce identical hashes
  const hashedKey = crypto
    .createHash(hashAlgorithm)
    .update(hashSalt)
    .update(':')
    .update(plaintextKey)
    .digest('hex');

  return {
    plaintextKey, // show once to the user
    hashedKey,    // store this in DB
    hashSalt,     // store salt alongside hash in DB
    metadata: {
      bytes,
      encoding,
      hashAlgorithm,
    },
  };
}

/**
 * Verify a submitted API key against the stored hash.
 *
 * Usage:
 *   const isValid = verifyApiKey(submittedKey, storedHashedKey, storedSalt);
 */
function verifyApiKey(submittedKey, storedHashedKey, storedSalt, hashAlgorithm = 'sha256') {
  if (!submittedKey || !storedHashedKey || !storedSalt) return false;

  const candidateHash = crypto
    .createHash(hashAlgorithm)
    .update(storedSalt)
    .update(':')
    .update(submittedKey)
    .digest('hex');

  // Constant-time comparison
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(storedHashedKey, 'hex');

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  generateApiKey,
  verifyApiKey,
};