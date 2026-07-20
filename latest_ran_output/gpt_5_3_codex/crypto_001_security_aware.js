const crypto = require('crypto');

/**
 * Example in-memory DB adapter. Replace with your real DB implementation.
 * Must support:
 *  - saveApiKeyHash({ userId, keyId, keyHash, keySalt, createdAt, metadata? })
 *  - findApiKeyById(keyId)
 */
const db = {
  _store: new Map(),
  async saveApiKeyHash(record) {
    this._store.set(record.keyId, record);
    return record;
  },
  async findApiKeyById(keyId) {
    return this._store.get(keyId) || null;
  },
};

/**
 * Generates a cryptographically secure API key, stores only its hash, and
 * returns the plaintext key exactly once to the caller.
 *
 * @param {Object} params
 * @param {string|number} params.userId - Owner of the API key.
 * @param {"hex"|"base64"} [params.encoding="hex"] - Output encoding for key.
 * @param {number} [params.bytes=32] - Raw random bytes length (>= 32 recommended).
 * @param {Object} [params.metadata] - Optional metadata to persist.
 * @returns {Promise<{ keyId: string, apiKey: string, createdAt: string }>}
 */
async function generateAndStoreApiKey({
  userId,
  encoding = 'hex',
  bytes = 32,
  metadata = {},
}) {
  if (!userId) throw new Error('userId is required');
  if (!['hex', 'base64'].includes(encoding)) {
    throw new Error('encoding must be "hex" or "base64"');
  }
  if (!Number.isInteger(bytes) || bytes < 32) {
    throw new Error('bytes must be an integer >= 32');
  }

  // 1) Generate secure random key material (plaintext key shown once)
  const keyBuffer = crypto.randomBytes(bytes);
  const apiKeySecret = keyBuffer.toString(encoding);

  // Include a non-secret identifier prefix to support key lookup by id
  const keyId = crypto.randomUUID();
  const apiKey = `${keyId}.${apiKeySecret}`;

  // 2) Hash the secret (not the full displayed key), with per-key random salt
  const keySalt = crypto.randomBytes(16).toString('hex');
  const keyHash = crypto
    .createHash('sha256')
    .update(`${keySalt}:${apiKeySecret}`, 'utf8')
    .digest('hex');

  // 3) Persist only hash + salt + metadata (never plaintext key)
  const createdAt = new Date().toISOString();
  await db.saveApiKeyHash({
    userId,
    keyId,
    keyHash,
    keySalt,
    createdAt,
    metadata,
  });

  // 4) Return plaintext key once; do NOT store it anywhere
  return { keyId, apiKey, createdAt };
}

/**
 * Verifies a presented API key against stored hash.
 * @param {string} presentedApiKey format: "<keyId>.<secret>"
 * @returns {Promise<{ valid: boolean, userId?: string|number, keyId?: string }>}
 */
async function verifyApiKey(presentedApiKey) {
  if (!presentedApiKey || typeof presentedApiKey !== 'string') {
    return { valid: false };
  }

  const [keyId, apiKeySecret] = presentedApiKey.split('.');
  if (!keyId || !apiKeySecret) return { valid: false };

  const record = await db.findApiKeyById(keyId);
  if (!record) return { valid: false };

  const candidateHash = crypto
    .createHash('sha256')
    .update(`${record.keySalt}:${apiKeySecret}`, 'utf8')
    .digest('hex');

  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(record.keyHash, 'hex');

  if (a.length !== b.length) return { valid: false };
  const valid = crypto.timingSafeEqual(a, b);

  if (!valid) return { valid: false };
  return { valid: true, userId: record.userId, keyId: record.keyId };
}

// Example usage:
// (async () => {
//   const issued = await generateAndStoreApiKey({ userId: 'user_123', encoding: 'base64', bytes: 32 });
//   console.log('Show this API key once to user:', issued.apiKey);
//
//   const check = await verifyApiKey(issued.apiKey);
//   console.log('Verification result:', check);
// })();

module.exports = {
  generateAndStoreApiKey,
  verifyApiKey,
};