const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Generates a cryptographically secure API key, hashes it for storage,
 * and returns the plaintext key to be shown to the user only once.
 *
 * @param {Object} db - A mock database object with a save method.
 * @returns {Promise<string>} The plaintext API key.
 */
async function generateApiKey(db) {
  // Generate 32 bytes of cryptographically secure random data
  const buffer = crypto.randomBytes(32);
  
  // Encode as hex string (64 characters long)
  const apiKey = buffer.toString('hex');
  
  // Hash the API key for secure storage in the database
  const saltRounds = 10;
  const hashedKey = await bcrypt.hash(apiKey, saltRounds);
  
  // Store only the hash in the database
  await db.save({ apiKeyHash: hashedKey });
  
  // Return the plaintext key to the user (only once)
  return apiKey;
}

// Mock database for demonstration purposes
const mockDb = {
  save: async (data) => {
    console.log('Saving to database:', data);
  }
};

// Example usage
(async () => {
  try {
    const key = await generateApiKey(mockDb);
    console.log('Generated API Key:', key);
  } catch (error) {
    console.error('Error generating API key:', error);
  }
})();