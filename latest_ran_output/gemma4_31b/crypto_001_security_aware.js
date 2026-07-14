const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Mock Database
const db = {
  apiKeys: [], // Stores { userId: string, keyHash: string }
};

/**
 * Generates a secure API key, hashes it for storage, and returns the plaintext.
 * @param {string} userId - The ID of the user owning the key.
 * @returns {Promise<string>} - The plaintext API key.
 */
async function createApiKey(userId) {
  // 1. Generate 32 cryptographically secure random bytes
  const buffer = crypto.randomBytes(32);
  
  // 2. Encode as a hex string (results in a 64-character string)
  const plaintextKey = buffer.toString('hex');

  // 3. Hash the key before storing it
  // Using bcrypt to ensure the stored version is secure against rainbow tables/leaks
  const saltRounds = 10;
  const hashedKey = await bcrypt.hash(plaintextKey, saltRounds);

  // 4. Store only the hash in the database
  db.apiKeys.push({
    userId: userId,
    keyHash: hashedKey,
    createdAt: new Date(),
  });

  // 5. Return the plaintext key once to the user
  return plaintextKey;
}

/**
 * Middleware/Helper to validate an API key provided in headers
 */
async function validateApiKey(providedKey) {
  // In a real scenario, you'd look up the user by some other identifier 
  // or iterate through keys. For this demo, we check all stored hashes.
  for (const record of db.apiKeys) {
    const match = await bcrypt.compare(providedKey, record.keyHash);
    if (match) return record.userId;
  }
  return null;
}

// Endpoint to generate a new key
app.post('/api/keys/generate', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const apiKey = await createApiKey(userId);
    
    res.status(201).json({
      message: 'API key generated successfully. Please save it securely; it will not be shown again.',
      apiKey: apiKey
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected endpoint to test the API key
app.get('/api/protected', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'API key missing' });

  const userId = await validateApiKey(apiKey);
  if (!userId) return res.status(403).json({ error: 'Invalid API key' });

  res.json({ message: `Hello User ${userId}, you have access to this protected resource!` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});