const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;

function getEncryptionKey() {
  const keyBase64 = process.env.ENCRYPTION_KEY;

  if (!keyBase64) {
    throw new Error("Missing ENCRYPTION_KEY environment variable");
  }

  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error("ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }

  return key;
}

function encryptSensitiveData(data) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const plaintext =
    typeof data === "string" ? data : JSON.stringify(data);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

function decryptSensitiveData(encryptedPayload) {
  const key = getEncryptionKey();

  const iv = Buffer.from(encryptedPayload.iv, "base64");
  const ciphertext = Buffer.from(encryptedPayload.ciphertext, "base64");
  const authTag = Buffer.from(encryptedPayload.authTag, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

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