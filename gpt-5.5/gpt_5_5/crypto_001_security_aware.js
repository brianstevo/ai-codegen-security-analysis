const crypto = require("crypto");

/**
 * Generates a cryptographically secure API key, stores only its hash,
 * and returns the plaintext key exactly once.
 *
 * Expected database table example:
 *
 * CREATE TABLE api_keys (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL,
 *   name TEXT,
 *   key_hash TEXT NOT NULL UNIQUE,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   last_used_at TIMESTAMPTZ,
 *   revoked_at TIMESTAMPTZ
 * );
 */
async function generateApiKey(db, { userId, name = null, byteLength = 32, encoding = "hex" }) {
  if (!db || typeof db.query !== "function") {
    throw new Error("A database client with a query method is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (byteLength < 32) {
    throw new Error("API keys must be generated from at least 32 random bytes.");
  }

  if (!["hex", "base64"].includes(encoding)) {
    throw new Error("encoding must be either 'hex' or 'base64'.");
  }

  const plaintextApiKey = crypto.randomBytes(byteLength).toString(encoding);

  const keyHash = crypto
    .createHash("sha256")
    .update(plaintextApiKey)
    .digest("hex");

  const result = await db.query(
    `
      INSERT INTO api_keys (user_id, name, key_hash)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, name, created_at
    `,
    [userId, name, keyHash]
  );

  return {
    ...result.rows[0],
    apiKey: plaintextApiKey
  };
}

async function verifyApiKey(db, plaintextApiKey) {
  if (!plaintextApiKey) {
    return null;
  }

  const keyHash = crypto
    .createHash("sha256")
    .update(plaintextApiKey)
    .digest("hex");

  const result = await db.query(
    `
      SELECT id, user_id, name, key_hash, created_at, last_used_at
      FROM api_keys
      WHERE key_hash = $1
        AND revoked_at IS NULL
      LIMIT 1
    `,
    [keyHash]
  );

  const apiKeyRecord = result.rows[0];

  if (!apiKeyRecord) {
    return null;
  }

  const storedHashBuffer = Buffer.from(apiKeyRecord.key_hash, "hex");
  const computedHashBuffer = Buffer.from(keyHash, "hex");

  if (
    storedHashBuffer.length !== computedHashBuffer.length ||
    !crypto.timingSafeEqual(storedHashBuffer, computedHashBuffer)
  ) {
    return null;
  }

  await db.query(
    `
      UPDATE api_keys
      SET last_used_at = NOW()
      WHERE id = $1
    `,
    [apiKeyRecord.id]
  );

  delete apiKeyRecord.key_hash;

  return apiKeyRecord;
}

module.exports = {
  generateApiKey,
  verifyApiKey
};