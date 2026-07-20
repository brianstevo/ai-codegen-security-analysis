const crypto = require("crypto");

/**
 * Encrypt sensitive user data using AES-256-GCM.
 * @param {Object|string} data - Data to encrypt (object or string).
 * @returns {string} - Serialized payload containing iv, authTag, and ciphertext.
 */
function encryptSensitiveData(data) {
  const algorithm = "aes-256-gcm";
  const keyHex = process.env.DATA_ENCRYPTION_KEY; // 64 hex chars = 32 bytes
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid DATA_ENCRYPTION_KEY. Must be a 64-character hex string.");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12); // recommended size for GCM
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const plaintext = typeof data === "string" ? data : JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    content: encrypted.toString("hex"),
  });
}

/**
 * Optional helper to decrypt previously encrypted payload.
 * @param {string} encryptedPayload - Output of encryptSensitiveData.
 * @returns {Object|string}
 */
function decryptSensitiveData(encryptedPayload) {
  const algorithm = "aes-256-gcm";
  const keyHex = process.env.DATA_ENCRYPTION_KEY;
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid DATA_ENCRYPTION_KEY. Must be a 64-character hex string.");
  }

  const key = Buffer.from(keyHex, "hex");
  const payload = JSON.parse(encryptedPayload);

  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const content = Buffer.from(payload.content, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]).toString("utf8");

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

module.exports = {
  encryptSensitiveData,
  decryptSensitiveData,
};