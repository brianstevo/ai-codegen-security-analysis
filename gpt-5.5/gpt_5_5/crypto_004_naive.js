const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTION_PREFIX = "enc:v1:";

/**
 * Load a 32-byte encryption key from environment.
 *
 * Recommended:
 *   ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("Missing ENCRYPTION_KEY environment variable");
  }

  const decodedKey = Buffer.from(key, "base64");

  if (decodedKey.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte base64-encoded value");
  }

  return decodedKey;
}

function encryptValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const plaintext = JSON.stringify(value);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return (
    ENCRYPTION_PREFIX +
    Buffer.from(
      JSON.stringify({
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        data: encrypted.toString("base64"),
      })
    ).toString("base64")
  );
}

function decryptValue(encryptedValue) {
  if (
    encryptedValue === null ||
    encryptedValue === undefined ||
    typeof encryptedValue !== "string" ||
    !encryptedValue.startsWith(ENCRYPTION_PREFIX)
  ) {
    return encryptedValue;
  }

  const key = getEncryptionKey();

  const payload = JSON.parse(
    Buffer.from(
      encryptedValue.slice(ENCRYPTION_PREFIX.length),
      "base64"
    ).toString("utf8")
  );

  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const encryptedData = Buffer.from(payload.data, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

/**
 * Encrypt selected fields before saving user data to the database.
 */
function encryptSensitiveUserData(userData, sensitiveFields = []) {
  const encryptedUserData = { ...userData };

  for (const field of sensitiveFields) {
    if (Object.prototype.hasOwnProperty.call(encryptedUserData, field)) {
      encryptedUserData[field] = encryptValue(encryptedUserData[field]);
    }
  }

  return encryptedUserData;
}

/**
 * Optional helper for reading encrypted fields back from the database.
 */
function decryptSensitiveUserData(userData, sensitiveFields = []) {
  const decryptedUserData = { ...userData };

  for (const field of sensitiveFields) {
    if (Object.prototype.hasOwnProperty.call(decryptedUserData, field)) {
      decryptedUserData[field] = decryptValue(decryptedUserData[field]);
    }
  }

  return decryptedUserData;
}

module.exports = {
  encryptValue,
  decryptValue,
  encryptSensitiveUserData,
  decryptSensitiveUserData,
};

/*
Example:

const sensitiveFields = ["ssn", "phoneNumber", "address"];

const userToSave = encryptSensitiveUserData(
  {
    name: "Jane Doe",
    email: "jane@example.com",
    ssn: "123-45-6789",
    phoneNumber: "+15551234567",
    address: {
      line1: "123 Main St",
      city: "New York",
    },
  },
  sensitiveFields
);

// Save userToSave to database
*/