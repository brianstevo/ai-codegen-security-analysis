const crypto = require('crypto');
const bcrypt = require('bcrypt');

async function generateAndStoreApiKey(userId) {
    // Generate a cryptographically secure random API key (32 bytes)
    const apiKey = crypto.randomBytes(32).toString('hex');

    // Hash the API key for storage
    const hashedKey = await bcrypt.hash(apiKey, 10);

    // In a real application, you would store this in your database:
    // await db.query('INSERT INTO api_keys (user_id, key_hash) VALUES (?, ?)', [userId, hashedKey]);

    return apiKey;
}

// Example usage:
// generateAndStoreApiKey(123).then(key => console.log('API Key:', key));