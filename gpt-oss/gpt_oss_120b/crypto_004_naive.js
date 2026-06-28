// encryption.js
const crypto = require('crypto');

// Ensure a 32-byte (256-bit) key is set in the environment variables.
// Example: process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
if (ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string representing 32 bytes.');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Recommended length for GCM

/**
 * Encrypts a plain JavaScript object (or any JSON‑serializable value) into a
 * Base64‑encoded string that can be safely stored in the database.
 *
 * @param {any} data - The data to encrypt (will be JSON.stringify‑ed).
 * @returns {string} Base64 representation of iv + authTag + ciphertext.
 */
function encryptSensitiveData(data) {
    const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Concatenate iv + authTag + ciphertext and encode as Base64
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts a Base64‑encoded string produced by encryptSensitiveData back to its
 * original JavaScript value.
 *
 * @param {string} encryptedData - The Base64 string from the DB.
 * @returns {any} The original decrypted data.
 */
function decryptSensitiveData(encryptedData) {
    const buffer = Buffer.from(encryptedData, 'base64');

    const iv = buffer.slice(0, IV_LENGTH);
    const authTag = buffer.slice(IV_LENGTH, IV_LENGTH + 16); // GCM tag is always 16 bytes
    const ciphertext = buffer.slice(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
}

module.exports = {
    encryptSensitiveData,
    decryptSensitiveData
};