import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Generates a cryptographically secure API key and returns both the plaintext key and its hash
 * @returns {Promise<{plaintext: string, hash: string}>} Object containing plaintext key and bcrypt hash
 */
export async function generateApiKey() {
  // Generate 32 bytes of cryptographically secure random data
  const randomBytes = crypto.randomBytes(32);
  
  // Encode as base64 for a more user-friendly format
  // (hex would be 64 characters, base64 is 44 characters)
  const plaintextKey = randomBytes.toString('base64');
  
  // Hash the key using bcrypt for secure storage
  // 10 rounds is a good balance between security and performance
  const hash = await bcrypt.hash(plaintextKey, 10);
  
  return {
    plaintext: plaintextKey,
    hash: hash
  };
}

/**
 * Verifies a plaintext API key against its stored hash
 * @param {string} plaintextKey - The plaintext API key to verify
 * @param {string} storedHash - The hash stored in the database
 * @returns {Promise<boolean>} True if the key matches the hash
 */
export async function verifyApiKey(plaintextKey, storedHash) {
  return await bcrypt.compare(plaintextKey, storedHash);
}

// Example usage in an Express application
import express from 'express';

const app = express();
app.use(express.json());

// In-memory storage for demonstration (use a real database in production)
const apiKeys = new Map();

/**
 * POST /api/keys/generate
 * Generates a new API key for a user
 */
app.post('/api/keys/generate', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Generate the API key
    const { plaintext, hash } = await generateApiKey();
    
    // Store only the hash in the database
    apiKeys.set(userId, hash);
    
    // Return the plaintext key to the user (only once!)
    res.json({
      apiKey: plaintext,
      message: 'Save this API key securely. You will not be able to see it again.',
      userId: userId
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

/**
 * POST /api/authenticate
 * Authenticates a request using an API key
 */
app.post('/api/authenticate', async (req, res) => {
  try {
    const { apiKey, userId } = req.body;
    
    if (!apiKey || !userId) {
      return res.status(400).json({ error: 'apiKey and userId are required' });
    }
    
    // Get the stored hash for this user
    const storedHash = apiKeys.get(userId);
    
    if (!storedHash) {
      return res.status(401).json({ error: 'Invalid API key or user' });
    }
    
    // Verify the provided key against the stored hash
    const isValid = await verifyApiKey(apiKey, storedHash);
    
    if (isValid) {
      res.json({
        success: true,
        message: 'API key is valid',
        userId: userId
      });
    } else {
      res.status(401).json({ error: 'Invalid API key' });
    }
  } catch (error) {
    console.error('Error authenticating API key:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/keys/verify
 * Verifies if an API key is valid (for testing purposes)
 */
app.post('/api/keys/verify', async (req, res) => {
  try {
    const { apiKey, userId } = req.body;
    
    if (!apiKey || !userId) {
      return res.status(400).json({ error: 'apiKey and userId are required' });
    }
    
    const storedHash = apiKeys.get(userId);
    
    if (!storedHash) {
      return res.json({ valid: false, message: 'User or API key not found' });
    }
    
    const isValid = await verifyApiKey(apiKey, storedHash);
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Error verifying API key:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Middleware to protect routes with API key authentication
export function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const userId = req.headers['x-user-id'];
  
  if (!apiKey || !userId) {
    return res.status(401).json({ error: 'API key and user ID required' });
  }
  
  // Store for use in route handlers
  req.apiKey = apiKey;
  req.userId = userId;
  
  next();
}

/**
 * Protected route example
 */
app.get('/api/protected', apiKeyAuth, async (req, res) => {
  try {
    const storedHash = apiKeys.get(req.userId);
    
    if (!storedHash) {
      return res.status(401).json({ error: 'Invalid API key or user' });
    }
    
    const isValid = await verifyApiKey(req.apiKey, storedHash);
    
    if (isValid) {
      res.json({
        message: 'Access granted to protected resource',
        userId: req.userId
      });
    } else {
      res.status(401).json({ error: 'Invalid API key' });
    }
  } catch (error) {
    console.error('Error accessing protected route:', error);
    res.status(500).json({ error: 'Access denied' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('API Key generation system is ready');
});

export default app;