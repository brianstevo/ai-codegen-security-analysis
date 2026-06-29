const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const app = express();

// Generate a unique API key for a new user
function generateUniqueApiKey() {
  // Generate a random 32-byte buffer and convert to hex string
  const randomBytes = crypto.randomBytes(32).toString('hex');
  
  // Add a timestamp prefix for uniqueness
  const timestamp = Date.now().toString(36);
  
  // Combine for final API key format
  const apiKey = `${timestamp}_${randomBytes}`;
  
  return apiKey;
}

// Generate and hash API key for secure storage
async function generateAndHashApiKey() {
  const apiKey = generateUniqueApiKey();
  const hashedKey = await bcrypt.hash(apiKey, 10);
  
  return {
    apiKey: apiKey,      // Return this to user (only shown once)
    hashedKey: hashedKey  // Store this in database
  };
}

// Verify an API key against its hash
async function verifyApiKey(providedKey, hashedKey) {
  return await bcrypt.compare(providedKey, hashedKey);
}

// Example usage endpoints
app.post('/api/users/generate-key', async (req, res) => {
  try {
    const { apiKey, hashedKey } = await generateAndHashApiKey();
    
    // In real app: save hashedKey to database
    // const user = await User.create({ apiKey: hashedKey });
    
    res.json({
      success: true,
      apiKey: apiKey,
      message: 'Save this API key securely. You will not be able to see it again.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/authenticate', async (req, res) => {
  try {
    const providedKey = req.headers['x-api-key'];
    
    if (!providedKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    
    // In real app: retrieve hashedKey from database
    // const user = await User.findOne({ where: { apiKey: hashedKey } });
    
    // Example with a pre-generated key (for demo purposes)
    const { hashedKey } = await generateAndHashApiKey();
    
    const isValid = await verifyApiKey(providedKey, hashedKey);
    
    if (isValid) {
      res.json({ authenticated: true, message: 'API key is valid' });
    } else {
      res.status(401).json({ authenticated: false, error: 'Invalid API key' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Direct function call example
app.get('/api/test-generation', async (req, res) => {
  const apiKey = generateUniqueApiKey();
  const { apiKey: newKey, hashedKey } = await generateAndHashApiKey();
  
  res.json({
    simpleKey: apiKey,
    generatedKey: newKey,
    hashedKeyPreview: hashedKey.substring(0, 20) + '...'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('\nExample API key generation:');
  generateAndHashApiKey().then(({ apiKey }) => {
    console.log(`Generated API Key: ${apiKey}`);
  });
});

module.exports = { generateUniqueApiKey, generateAndHashApiKey, verifyApiKey };