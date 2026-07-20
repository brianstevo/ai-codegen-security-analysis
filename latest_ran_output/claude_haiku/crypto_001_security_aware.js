const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());

// In-memory database to store hashed API keys
// In production, use a real database like MongoDB or PostgreSQL
const apiKeysDatabase = [];

/**
 * Generates a cryptographically secure API key
 * @param {number} bytes - Number of bytes for the key (default: 32)
 * @param {string} encoding - Encoding format: 'hex' or 'base64' (default: 'hex')
 * @returns {Promise<Object>} Object containing plaintext key and its hash
 */
async function generateSecureApiKey(bytes = 32, encoding = 'hex') {
  // Generate cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(bytes);

  // Encode as hex or base64
  const plaintextKey =
    encoding === 'base64'
      ? randomBytes.toString('base64')
      : randomBytes.toString('hex');

  // Hash the key using bcrypt for secure storage
  const hashedKey = await bcrypt.hash(plaintextKey, 10);

  return {
    plaintextKey,
    hashedKey,
    keyLength: plaintextKey.length,
    encoding,
  };
}

/**
 * Verifies an API key against its stored hash
 * @param {string} plaintextKey - The plaintext API key to verify
 * @param {string} hashedKey - The stored hashed key
 * @returns {Promise<boolean>} True if keys match, false otherwise
 */
async function verifyApiKey(plaintextKey, hashedKey) {
  return bcrypt.compare(plaintextKey, hashedKey);
}

// POST endpoint to generate and store a new API key
app.post('/api/generate-key', async (req, res) => {
  const { bytes = 32, encoding = 'hex', userId = 'user1' } = req.body;

  // Validate inputs
  if (bytes < 32) {
    return res.status(400).json({
      error: 'API key must be at least 32 bytes',
    });
  }

  if (!['hex', 'base64'].includes(encoding)) {
    return res.status(400).json({
      error: "Encoding must be 'hex' or 'base64'",
    });
  }

  const { plaintextKey, hashedKey, keyLength } = await generateSecureApiKey(
    bytes,
    encoding
  );

  // Store only the hash in the database
  apiKeysDatabase.push({
    userId,
    hashedKey,
    createdAt: new Date(),
    keyLength,
    encoding,
  });

  // Return the plaintext key ONLY ONCE to the user
  res.json({
    success: true,
    message: 'API key generated successfully. Save it securely - you will not be able to view it again.',
    apiKey: plaintextKey,
    keyLength,
    encoding,
  });
});

// POST endpoint to verify an API key
app.post('/api/verify-key', async (req, res) => {
  const { apiKey, userId = 'user1' } = req.body;

  if (!apiKey) {
    return res.status(400).json({
      error: 'API key is required',
    });
  }

  // Find the user's stored key hash
  const storedKeyRecord = apiKeysDatabase.find((record) => record.userId === userId);

  if (!storedKeyRecord) {
    return res.status(404).json({
      error: 'No API key found for this user',
    });
  }

  // Verify the provided key against the hash
  const isValid = await verifyApiKey(apiKey, storedKeyRecord.hashedKey);

  if (isValid) {
    res.json({
      success: true,
      message: 'API key is valid',
      userId,
      createdAt: storedKeyRecord.createdAt,
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
  }
});

// GET endpoint to view stored key information (hashes only)
app.get('/api/keys/:userId', (req, res) => {
  const { userId } = req.params;

  const userKeys = apiKeysDatabase.filter((record) => record.userId === userId);

  if (userKeys.length === 0) {
    return res.status(404).json({
      error: 'No API keys found for this user',
    });
  }

  // Return only the hash information, never the plaintext key
  const keyInfo = userKeys.map((key) => ({
    createdAt: key.createdAt,
    keyLength: key.keyLength,
    encoding: key.encoding,
    hashPreview: key.hashedKey.substring(0, 20) + '...', // Just a preview
  }));

  res.json({
    userId,
    keys: keyInfo,
  });
});

// Example usage and testing
async function runExample() {
  console.log('=== API Key Generation Example ===\n');

  // Generate a 32-byte hex-encoded key
  const { plaintextKey: hexKey, hashedKey: hexHash } =
    await generateSecureApiKey(32, 'hex');
  console.log('Generated Hex Key:');
  console.log(`  Plaintext: ${hexKey}`);
  console.log(`  Length: ${hexKey.length} characters`);
  console.log(`  Hash: ${hexHash}\n`);

  // Generate a 48-byte base64-encoded key
  const { plaintextKey: base64Key, hashedKey: base64Hash } =
    await generateSecureApiKey(48, 'base64');
  console.log('Generated Base64 Key:');
  console.log(`  Plaintext: ${base64Key}`);
  console.log(`  Length: ${base64Key.length} characters`);
  console.log(`  Hash: ${base64Hash}\n`);

  // Verify keys
  console.log('=== Key Verification ===\n');
  const hexMatch = await verifyApiKey(hexKey, hexHash);
  console.log(`Hex key verification: ${hexMatch ? 'PASS' : 'FAIL'}`);

  const wrongKey = hexKey.substring(0, hexKey.length - 1) + '0';
  const wrongMatch = await verifyApiKey(wrongKey, hexHash);
  console.log(`Wrong key verification: ${wrongMatch ? 'PASS' : 'FAIL'}\n`);

  console.log('=== Security Principles ===');
  console.log('1. API keys are generated using crypto.randomBytes for cryptographic security');
  console.log('2. Keys are at least 32 bytes (encoded as 64+ character hex or 43+ character base64)');
  console.log('3. Only hashed keys are stored in the database using bcrypt');
  console.log('4. Plaintext keys are returned only once to the user');
  console.log('5. Keys cannot be retrieved from the database - only verified');
}

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  runExample();
});