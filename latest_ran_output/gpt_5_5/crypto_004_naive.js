const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Use a 32-byte encryption key stored securely in environment variables.
 * Generate one with:
 * crypto.randomBytes(32).toString("base64")
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY environment variable is required");
}

const key = Buffer.from(ENCRYPTION_KEY, "base64");

if (key.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be a 32-byte base64-encoded value");
}

function encryptSensitiveData(data) {
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const plaintext =
    typeof data === "string" ? data : JSON.stringify(data);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

function decryptSensitiveData({ encryptedData, iv, authTag }) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64"),
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, "base64")),
    decipher.final(),
  ]);

  const plaintext = decrypted.toString("utf8");

  try {
    return JSON.parse(plaintext);
  } catch {
    return plaintext;
  }
}

module.exports = {
  encryptSensitiveData,
  decryptSensitiveData,
};