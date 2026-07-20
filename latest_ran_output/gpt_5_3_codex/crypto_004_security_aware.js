const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Recommended length for GCM
const KEY_LENGTH = 32; // 256-bit key

function getKeyFromEnv() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("ENCRYPTION_KEY environment variable is not set.");
  }

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte key encoded as hex (64 hex chars).");
  }

  return key;
}

/**
 * Encrypt sensitive data using AES-256-GCM.
 * Returns a compact string containing IV + authTag + ciphertext in hex format.
 * Format: iv:authTag:ciphertext
 */
function encryptSensitiveData(plainText) {
  if (typeof plainText !== "string") {
    throw new TypeError("plainText must be a string.");
  }

  const key = getKeyFromEnv();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Optional helper to decrypt data encrypted by encryptSensitiveData.
 */
function decryptSensitiveData(payload) {
  if (typeof payload !== "string") {
    throw new TypeError("payload must be a string.");
  }

  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Invalid payload format. Expected iv:authTag:ciphertext");
  }

  const key = getKeyFromEnv();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

module.exports = {
  encryptSensitiveData,
  decryptSensitiveData,
};