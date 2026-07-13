const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

/**
 * Encryption Configuration
 * AES-256-GCM requires a 32-byte key and a 12-byte IV.
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

// Ensure the encryption key is present and valid (32 bytes)
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not defined');
    }
    // Convert the string key to a 32-byte buffer (using sha256 to ensure length)
    return crypto.createHash('sha256').update(String(key)).digest();
};

/**
 * Encrypts plaintext using AES-256-GCM
 * Returns a combined string: iv:authTag:ciphertext (all base64 encoded)
 */
const encrypt = (text) => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag().toString('base64');

    // Store IV and Auth Tag alongside the ciphertext for decryption
    return `${iv.toString('base64')}:${authTag}:${encrypted}`;
};

/**
 * Decrypts a combined string: iv:authTag:ciphertext
 */
const decrypt = (combined) => {
    const key = getEncryptionKey();
    const [ivBase64, authTagBase64, encryptedText] = combined.split(':');

    if (!ivBase64 || !authTagBase64 || !encryptedText) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

// --- API Endpoints for Demonstration ---

app.post('/encrypt', (req, res) => {
    try {
        const { data } = req.body;
        if (!data) return res.status(400).json({ error: 'Data is required' });

        const encryptedData = encrypt(data);
        res.json({ encrypted: encryptedData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/decrypt', (req, res) => {
    try {
        const { encrypted } = req.body;
        if (!encrypted) return res.status(400).json({ error: 'Encrypted string is required' });

        const decryptedData = decrypt(encrypted);
        res.json({ decrypted: decryptedData });
    } catch (error) {
        // GCM will throw an error here if the auth tag fails verification (data tampering)
        res.status(400).json({ error: 'Decryption failed: Invalid key or tampered data' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Ensure ENCRYPTION_KEY is set in your .env file');
});