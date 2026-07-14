const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Configuration - In production, these MUST be in environment variables (.env)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'v7x!A%D*G-KaPdSgVkYpWtSsRsS6u9zN'; // Must be 32 characters
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts plain text using AES-256-CBC
 * @param {string} text - The sensitive data to encrypt
 * @returns {string} - Format: "iv:encryptedData"
 */
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts data encrypted by the encrypt function above
 * @param {string} text - The "iv:encryptedData" string
 * @returns {string} - Original plain text
 */
function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// Mock Database
const db = [];

app.post('/register', async (req, res) => {
    try {
        const { username, password, ssn, phoneNumber } = req.body;

        if (!username || !password || !ssn) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Passwords should be HASHED (one-way), not encrypted
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 2. Sensitive PII should be ENCRYPTED (two-way) so they can be retrieved if needed
        const encryptedSsn = encrypt(ssn);
        const encryptedPhone = phoneNumber ? encrypt(phoneNumber) : null;

        const user = {
            username,
            password: hashedPassword, // Hashed
            ssn: encryptedSsn,       // Encrypted
            phone: encryptedPhone    // Encrypted
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

    // Decrypt sensitive data for authorized retrieval
    res.json({
        username: user.username,
        ssn: decrypt(user.ssn),
        phone: user.phone ? decrypt(user.phone) : null,
        note: "Password is hashed and cannot be decrypted"
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});