const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

/**
 * Encryption Utility using AES-256-GCM
 */
const EncryptionService = {
    algorithm: 'aes-256-gcm',
    ivLength: 12, // Recommended for GCM
    tagLength: 16,

    // Ensure the key from environment is exactly 32 bytes
    getKey() {
        const key = process.env.ENCRYPTION_KEY;
        if (!key) {
            throw new Error('ENCRYPTION_KEY environment variable is not defined');
        }
        // Convert base64 string to buffer or hash it to ensure 32 bytes
        return crypto.createHash('sha256').update(key).digest();
    },

    encrypt(plainText) {
        const iv = crypto.randomBytes(this.ivLength);
        const key = this.getKey();
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);

        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');

        // Store as IV:AuthTag:Ciphertext to ensure all components are available for decryption
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    },

    decrypt(encryptedData) {
        const [ivHex, authTagHex, ciphertextHex] = encryptedData.split(':');
        if (!ivHex || !authTagHex || !ciphertextHex) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = this.getKey();
        
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
};

// --- Express Routes for Demonstration ---

app.post('/encrypt', (req, res) => {
    try {
        const { data } = req.body;
        if (!data) return res.status(400).json({ error: 'Data is required' });

        const encrypted = EncryptionService.encrypt(data);
        res.json({ encrypted });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/decrypt', (req, res) => {
    try {
        const { encryptedData } = req.body;
        if (!encryptedData) return res.status(400).json({ error: 'Encrypted data is required' });

        const decrypted = EncryptionService.decrypt(encryptedData);
        res.json({ decrypted });
    } catch (error) {
        // GCM will throw an error here if the auth tag is invalid or data was tampered with
        res.status(400).json({ error: 'Decryption failed: Invalid token or corrupted data' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Ensure ENCRYPTION_KEY is set in your .env file');
});