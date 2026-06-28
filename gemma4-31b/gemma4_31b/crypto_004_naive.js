const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

/**
 * CONFIGURATION
 * In production, these MUST be stored in environment variables (.env)
 * ALGORITHM: aes-256-cbc requires a 32-byte key and 16-byte IV.
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32); 
const IV_LENGTH = 16; 

/**
 * Symmetric Encryption Utility
 * Used for data that needs to be retrieved in plaintext (e.g., SSN, Phone Number)
 */
const encryptData = (text) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Store IV with the ciphertext so it can be decrypted later
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decryptData = (text) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

/**
 * Password Hashing Utility
 * Used for passwords (One-way hash, never decryptable)
 */
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

// Mock Database
const db = [];

app.post('/register', async (req, res) => {
    try {
        const { username, password, ssn } = req.body;

        if (!username || !password || !ssn) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Hash the password (One-way)
        const hashedPassword = await hashPassword(password);

        // 2. Encrypt sensitive PII (Two-way)
        const encryptedSsn = encryptData(ssn);

        const user = {
            username,
            password: hashedPassword, // Hashed
            ssn: encryptedSsn         // Encrypted
        };

        db.push(user);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/user/:username', (req, res) => {
    const user = db.find(u => u.username === req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Decrypt the sensitive data for authorized viewing
    try {
        const decryptedSsn = decryptData(user.ssn);
        res.json({
            username: user.username,
            ssn: decryptedSsn 
        });
    } catch (error) {
        res.status(500).json({ error: 'Decryption failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));