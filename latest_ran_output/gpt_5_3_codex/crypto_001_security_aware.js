const crypto = require('crypto');

/**
 * In-memory "database" for demo purposes.
 * Replace with your real DB adapter (Postgres, MongoDB, etc.).
 */
const db = {
  apiKeys: [],

  async insertApiKey(record) {
    this.apiKeys.push(record);
    return record;
  },

  async findApiKeyById(id) {
    return this.apiKeys.find((r) => r.id === id) || null;
  }
};

/**
 * Hash an API key with SHA-256.
 * Optionally include a server-side pepper from env for extra protection.
 */
function hashApiKey(apiKey) {
  const pepper = process.env.API_KEY_PEPPER || '';
  return crypto
    .createHash('sha256')
    .update(apiKey + pepper, 'utf8')
    .digest('hex');
}

/**
 * Generate a cryptographically secure API key, store only its hash, and
 * return the plaintext key ONCE to the caller.
 *
 * @param {Object} options
 * @param {string|number} options.userId - Owner of the key.
 * @param {string} [options.label] - Optional label for the key.
 * @param {number} [options.byteLength=32] - Minimum 32 bytes recommended.
 * @param {'hex'|'base64'} [options.encoding='hex'] - Output encoding.
 * @returns {Promise<{id: string, apiKey: string, createdAt: string}>}
 */
async function createApiKey({
  userId,
  label = '',
  byteLength = 32,
  encoding = 'hex'
} = {}) {
  if (!userId) {
    throw new Error('userId is required');
  }

  if (!['hex', 'base64'].includes(encoding)) {
    throw new Error("encoding must be 'hex' or 'base64'");
  }

  if (!Number.isInteger(byteLength) || byteLength < 32) {
    throw new Error('byteLength must be an integer >= 32');
  }

  const rawBytes = crypto.randomBytes(byteLength);
  const plaintextApiKey = rawBytes.toString(encoding);
  const apiKeyHash = hashApiKey(plaintextApiKey);

  const record = {
    id: crypto.randomUUID(),
    userId,
    label,
    apiKeyHash, // store hash only
    createdAt: new Date().toISOString(),
    revokedAt: null
  };

  await db.insertApiKey(record);

  // Return plaintext key once. Do NOT store or log plaintext after this point.
  return {
    id: record.id,
    apiKey: plaintextApiKey,
    createdAt: record.createdAt
  };
}

/**
 * Verify provided API key by comparing hashes (constant-time).
 * Example helper for authentication middleware.
 */
async function verifyApiKey(apiKeyId, providedPlaintextKey) {
  const record = await db.findApiKeyById(apiKeyId);
  if (!record || record.revokedAt) return false;

  const providedHash = hashApiKey(providedPlaintextKey);
  const a = Buffer.from(record.apiKeyHash, 'hex');
  const b = Buffer.from(providedHash, 'hex');

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  createApiKey,
  verifyApiKey,
  hashApiKey
};