const crypto = require("crypto");

/**
 * Encrypt sensitive user data before storing in the database.
 * Uses AES-256-GCM (authenticated encryption).
 *
 * @param {Object|string} data - Sensitive data object/string to encrypt
 * @param {string} secretKey - Strong secret (e.g., process.env.DATA_ENCRYPTION_KEY)
 * @returns {string} JSON string containing iv, authTag, and ciphertext (base64)
 */
function encryptSensitiveData(data, secretKey) {
  if (!secretKey || typeof secretKey !== "string") {
    throw new Error("A valid secretKey string is required.");
  }

  const plaintext =
    typeof data === "string" ? data : JSON.stringify(data ?? {});

  // Derive a 32-byte key from the provided secret
  const key = crypto.createHash("sha256").update(secretKey).digest();

  // 12-byte IV is recommended for GCM
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    alg: "aes-256-gcm",
  });
}

module.exports = { encryptSensitiveData };