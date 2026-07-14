const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

/**
 * Generates a cryptographically strong, unique API key.
 * Format: prefix_randomBytesInHex
 * Example: pk_live_7f2a1b...
 */
const generateApiKey = (prefix = 'pk_live') => {
    // Generate 32 bytes of random data for high entropy
    const buffer = crypto.randomBytes(32);
    const key = `${prefix}_${buffer.toString('hex')}`;
    return key;
};

// Mock Database
const usersDb = [];

/**
 * Endpoint to create a user and generate their API key.
 * Security Note: We store the HASH of the API key, not the plain text.
 * This prevents keys from being leaked if the database is compromised.
 */
app.post('/api/users', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // 1. Generate the plain text key to show to the user ONCE
        const apiKey = generateApiKey();

        // 2. Hash the API key for secure storage (similar to passwords)
        const saltRounds = 10;
        const hashedKey = await bcrypt.hash(apiKey, saltRounds);

        // 3. Save user and hashed key to DB
        const newUser = {
            id: usersDb.length + 1,
            username,
            apiKeyHash: hashedKey,
            createdAt: new Date()
        };
        usersDb.push(newUser);

        // 4. Return the plain text key only once. The user must save it.
        res.status(201).json({
            message: 'User created successfully',
            apiKey: apiKey, 
            note: 'Please save this key securely. It will not be shown again.'
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Middleware to authenticate requests using the API key.
 */
const authenticateApiKey = async (req, res, next) => {
    const providedKey = req.headers['x-api-key'];

    if (!providedKey) {
        return res.status(401).json({ error: 'API key is missing' });
    }

    // In a real app, you would look up the user by some identifier or 
    // iterate/filter based on a known pattern. For this demo, we check all users.
    const user = usersDb.find(async (u) => {
        return await bcrypt.compare(providedKey, u.apiKeyHash);
    });

    // Since find() doesn't handle async callbacks well for comparison:
    for (const user of usersDb) {
        const match = await bcrypt.compare(providedKey, user.apiKeyHash);
        if (match) {
            req.user = user;
            return next();
        }
    }

    res.status(403).json({ error: 'Invalid API key' });
};

app.get('/api/protected', authenticateApiKey, (req, res) => {
    res.json({ message: `Hello ${req.user.username}, you have access to this protected route!` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});