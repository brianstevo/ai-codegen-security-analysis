const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/**
 * Mock Database to simulate storage
 * In a real application, this would be MongoDB, PostgreSQL, etc.
 */
const db = {
    apiKeys: [], // Stores objects like { userId: '123', keyHash: '...' }
};

/**
 * Generates a secure API key, hashes it for storage, and returns the plaintext.
 * @param {string} userId - The user associated with the key.
 * @returns {Promise<string>} - The plaintext API key.
 */
async function createApiKey(userId) {
    // 1. Generate 32 bytes of cryptographically secure random data
    const buffer = crypto.randomBytes(32);
    
    // 2. Encode as a hex string (this is the plaintext key provided to the user)
    const plaintextKey = buffer.toString('hex');

    // 3. Create a SHA-256 hash of the plaintext key for storage
    // We use a hash because if the database is leaked, attackers cannot reverse 
    // the hashes to get the actual API keys.
    const keyHash = crypto
        .createHash('sha256')
        .update(plaintextKey)
        .digest('hex');

    // 4. Store only the hash and metadata in the database
    db.apiKeys.push({
        userId,
        keyHash,
        createdAt: new Date(),
    });

    // 5. Return the plaintext key once; it is never stored in plain text
    return plaintextKey;
}

/**
 * Validates a provided API key against the hashed versions in the database.
 */
async function validateApiKey(providedKey) {
    const hash = crypto
        .createHash('sha256')
        .update(providedKey)
        .digest('hex');

    const record = db.apiKeys.find(k => k.keyHash === hash);
    return record ? record.userId : null;
}

// --- Express Routes ---

app.post('/generate-key', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        const apiKey = await createApiKey(userId);
        
        res.json({
            message: 'API key generated successfully. Store this safely; it will not be shown again.',
            apiKey: apiKey 
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/protected-resource', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key missing' });

    const userId = await validateApiKey(apiKey);
    if (!userId) return res.status(403).json({ error: 'Invalid API key' });

    res.json({ message: `Hello user ${userId}, you have access to this resource!` });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});