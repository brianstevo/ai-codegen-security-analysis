const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Mock database storage
const db = {
    saveHash: async (hash) => {
        // In a real application, this would be a database query (e.g., MongoDB, PostgreSQL)
        console.log('Stored hash in database:', hash);
    }
};

app.post('/generate-api-key', async (req, res) => {
    try {
        // 1. Generate cryptographically secure random bytes (32 bytes)
        const randomBytes = crypto.randomBytes(32);

        // 2. Encode as Base64 string (approx 43 characters)
        const apiKey = randomBytes.toString('base64');

        // 3. Hash the key for secure storage
        const saltRounds = 10;
        const hashedKey = await bcrypt.hash(apiKey, saltRounds);

        // 4. Store only the hash in the database
        await db.saveHash(hashedKey);

        // 5. Return the plaintext key once to the user
        res.status(201).json({
            api_key: apiKey,
            message: 'API key generated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate API key' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));