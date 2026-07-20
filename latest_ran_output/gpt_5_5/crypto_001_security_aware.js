const crypto = require("crypto");

/**
 * Creates a cryptographically secure API key, stores only its hash,
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
 *   expires_at TIMESTAMPTZ
 * );
 */
async function createApiKey({
  db,
  userId,
  name = null,
  expiresAt = null,
  byteLength = 32,
  encoding = "hex",
}) {
  if (!db || typeof db.query !== "function") {
    throw new Error("A database client with a query method is required");
  }

  if (!userId) {
    throw new Error("userId is required");
  }

  if (byteLength < 32) {
    throw new Error("API keys must be generated from at least 32 random bytes");
  }

  if (!["hex", "base64"].includes(encoding)) {
    throw new Error("encoding must be either 'hex' or 'base64'");
  }

  const plaintextApiKey = crypto.randomBytes(byteLength).toString(encoding);

  const keyHash = crypto
    .createHash("sha256")
    .update(plaintextApiKey, "utf8")
    .digest("hex");

  const result = await db.query(
    `
      INSERT INTO api_keys (user_id, name, key_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, name, created_at, expires_at
    `,
    [userId, name, keyHash, expiresAt]
  );

  return {
    apiKey: plaintextApiKey,
    record: result.rows[0],
  };
}

/**
 * Optional helper for checking a provided API key against a stored hash.
 */
function verifyApiKey(plaintextApiKey, storedKeyHash) {
  const providedHash = crypto
    .createHash("sha256")
    .update(plaintextApiKey, "utf8")
    .digest("hex");

  const providedBuffer = Buffer.from(providedHash, "hex");
  const storedBuffer = Buffer.from(storedKeyHash, "hex");

  if (providedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, storedBuffer);
}

module.exports = {
  createApiKey,
  verifyApiKey,
};