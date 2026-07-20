```javascript
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// In-memory store for demonstration (use a database in production)
const apiKeys = new Map();
const users = new Map();

/**
 * Generates a unique API key for a new user
 * @param {string} userId - The unique identifier for the user
 * @param {Object} options - Optional configuration
 * @param {number} options.keyLength - Length of the API key in bytes (default: 32)
 * @param {string} options.prefix - Optional prefix for the API key
 * @param {number} options.expiresInDays - Number of days until key expires (default: 365)
 * @returns {Object} - Object containing the API key details
 */
async function generateApiKey(userId, options = {}) {
  const {
    keyLength = 32,
    prefix = 'ak',
    expiresInDays = 365,
  } = options;

  if (!userId) {
    throw new Error('User ID is required to generate an API key');
  }

  // Generate a cryptographically secure random key
  const rawKey = crypto.randomBytes(keyLength).toString('hex');

  // Create the full API key with prefix
  const apiKey = `${prefix}_${rawKey}`;

  // Hash the API key for secure storage
  const saltRounds = 10;
  const hashedKey = await bcrypt.hash(apiKey, saltRounds);

  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Create API key metadata
  const apiKeyMetadata = {
    id: crypto.randomUUID(),
    userId,
    hashedKey,
    prefix: apiKey.substring(0, 8) + '...',  // Store partial key for identification
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    isActive: true,
    lastUsed: null,
    usageCount: 0,
  };

  // Store the hashed key
  if (!apiKeys.has(userId)) {
    apiKeys.set(userId, []);
  }
  apiKeys.get(userId).push(apiKeyMetadata);

  return {
    apiKey,               // Return the plain key ONLY once (don't store this)
    keyId: apiKeyMetadata.id,
    prefix: apiKeyMetadata.prefix,
    expiresAt: apiKeyMetadata.expiresAt,
    createdAt: apiKeyMetadata.createdAt,
  };
}

/**
 * Validates an API key
 * @param {string} apiKey - The API key to validate
 * @returns {Object|null} - User data if valid, null if invalid
 */
async function validateApiKey(apiKey) {
  if (!apiKey) {
    return null;
  }

  // Iterate through all users' keys
  for (const [userId, keys] of apiKeys.entries()) {
    for (const keyMetadata of keys) {
      if (!keyMetadata.isActive) continue;

      // Check expiration
      if (new Date() > new Date(keyMetadata.expiresAt)) {
        keyMetadata.isActive = false;
        continue;
      }

      // Verify the key against the stored hash
      const isValid = await bcrypt.compare(apiKey, keyMetadata.hashedKey);

      if (isValid) {
        // Update usage statistics
        keyMetadata.lastUsed = new Date().toISOString();
        keyMetadata.usageCount += 1;

        return {
          userId,
          keyId: keyMetadata.id,
          expiresAt: keyMetadata.expiresAt,
        };
      }
    }
  }

  return null;
}

/**
 * Revokes an API key
 * @param {string} userId - The user's ID
 * @param {string} keyId - The key ID to revoke
 * @returns {boolean} - True if revoked successfully
 */
function revokeApiKey(userId, keyId) {
  const userKeys = apiKeys.get(userId);
  if (!userKeys) return false;

  const key = userKeys.find((k) => k.id === keyId);
  if (!key) return false;

  key.isActive = false;
  return true;
}

// Middleware to authenticate API key
const authenticateApiKey = async (req, res, next) => {
  const apiKey =
    req.headers['x-api-key'] ||
    req.query.api_key ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required',
    });
  }

  const userData = await validateApiKey(apiKey);

  if (!userData) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired API key',
    });
  }

  req.user = userData;
  next();
};

// Routes

// Register a new user and generate an API key
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username, email, and password are required',
      });
    }

    // Check if user already exists
    if (users.has(email)) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.set(email, user);

    // Generate API key for the new user
    const apiKeyData = await generateApiKey(userId, {
      prefix: 'ak',
      expiresInDays: 365,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        username,
        email,
        createdAt: user.createdAt,
      },
      apiKey: {
        key: apiKeyData.apiKey,   // Show only once!
        keyId: apiKeyData.keyId,
        expiresAt: apiKeyData.expiresAt,
        createdAt: apiKeyData.createdAt,
        warning: 'Store this API key securely. It will not be shown again.',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user',
    });
  }
});

// Generate a new API key for an existing user
app.post('/api/users/api-keys', authenticateApiKey, async (req, res) => {
  try {
    const { expiresInDays = 365, prefix = 'ak' } = req.body;
    const { userId } = req.user;

    const apiKeyData = await generateApiKey(userId, {
      prefix,
      expiresInDays,
    });

    res.status(201).json({
      message: 'API key generated successfully',
      apiKey: {
        key: apiKeyData.apiKey,   // Show only once!
        keyId: apiKeyData.keyId,
        expiresAt: apiKeyData.expiresAt,
        createdAt: apiKeyData.createdAt,
        warning: 'Store this API key securely. It will not be shown again.',
      },
    });