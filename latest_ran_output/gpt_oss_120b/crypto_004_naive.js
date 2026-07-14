// utils/encryption.js
const crypto = require('crypto');

// AES-256-GCM provides confidentiality + integrity.
// Ensure ENCRYPTION_KEY is a 64‑character hex string (32 bytes) in your environment.
const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

if (!KEY.length || KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64‑char hex string (32 bytes).');
}

/**
 * Encrypts an arbitrary JavaScript value (object, string, etc.) for safe storage.
 *
 * @param {any} data - The data to encrypt. Will be JSON.stringify‑ed.
 * @returns {string} Base64‑encoded payload containing IV + auth tag + ciphertext.
 */
function encryptData(data) {
    const iv = crypto.randomBytes(12); // 96‑bit nonce recommended for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    const plaintext = JSON.stringify(data);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag(); // 16‑byte authentication tag

    // Concatenate IV + authTag + ciphertext and encode as base64 for storage.
    const payload = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'base64')
    ]).toString('base64');

    return payload;
}

/**
 * Decrypts a payload produced by encryptData().
 *
 * @param {string} payload - Base64‑encoded string containing IV + auth tag + ciphertext.
 * @returns {any} The original decrypted value (parsed from JSON).
 */
function decryptData(payload) {
    const data = Buffer.from(payload, 'base64');

    // Extract components based on sizes used in encryptData().
    const iv = data.slice(0, 12);               // 12‑byte IV
    const authTag = data.slice(12, 28);         // 16‑byte tag
    const ciphertext = data.slice(28);          // remaining bytes

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
}

module.exports = {
    encryptData,
    decryptData
};