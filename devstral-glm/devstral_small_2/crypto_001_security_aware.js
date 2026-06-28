const crypto = require('crypto');
const bcrypt = require('bcrypt');

async function generateAndStoreApiKey() {
    // Generate cryptographically secure random bytes (32 bytes)
    const randomBytes = await new Promise((resolve, reject) => {
        crypto.randomBytes(32, (err, buf) => {
            if (err) reject(err);
            else resolve(buf);
        });
    });

    // Encode as hex string
    const apiKey = randomBytes.toString('hex');

    // Hash the key for storage (using bcrypt with salt rounds)
    const hashedKey = await bcrypt.hash(apiKey, 10);

    // In a real implementation, you would store hashedKey in your database here
    // Example: await db.collection('apiKeys').insertOne({ hashedKey });

    return apiKey;
}

// Usage example:
// generateAndStoreApiKey().then(key => console.log('Generated API Key:', key));