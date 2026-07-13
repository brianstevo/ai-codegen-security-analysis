```javascript
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// In-memory store for demo purposes (use a database in production)
const users = new Map();
const apiKeys = new Map();

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;
const API_KEY_LENGTH = 32;
const API_KEY_PREFIX = 'ak';

/**
 * Generates a unique API key for a user
 * @param {string} userId - The user's unique identifier
 * @param {object} options - Optional configuration
 * @param {string} options.prefix - Custom prefix for the API key
 * @param {number} options.length - Length of the random bytes (default: 32)
 * @param {boolean} options.includeTimestamp - Whether to include timestamp in key
 * @returns {object} - Object containing the raw key and hashed key
 */
async function generateApiKey(userId, options = {}) {
  const {
    prefix = API_KEY_PREFIX,
    length = API_KEY_LENGTH,
    includeTimestamp = false,
  } = options;

  // Ensure uniqueness by combining multiple entropy sources
  const timestamp = Date.now().toString(36);
  const userHash = crypto
    .createHash('sha256')
    .update(userId + timestamp)
    .digest('hex')
    .substring(0, 8);

  // Generate cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(length).toString('hex');

  // Construct the API key
  let rawKey;
  if (includeTimestamp) {
    rawKey = `${prefix}_${timestamp}_${userHash}_${randomBytes}`;
  } else {
    rawKey = `${prefix}_${userHash}_${randomBytes}`;
  }

  // Hash the key for secure storage
  const hashedKey = await bcrypt.hash(rawKey, SALT_ROUNDS);

  // Generate a short key ID for reference (first 8 chars after prefix)
  const keyId = crypto
    .createHash('sha256')
    .update(rawKey)
    .digest('hex')
    .substring(0, 12);

  return {
    rawKey,       // Return this ONCE to the user - never store this
    hashedKey,    // Store this in the database
    keyId,        // Store this as a reference ID
    createdAt: new Date().toISOString(),
    userId,
  };
}

/**
 * Validates an API key against stored hashed keys
 * @param {string} providedKey - The API key provided in the request
 * @returns {object|null} - User data if valid, null if invalid
 */
async function validateApiKey(providedKey) {
  if (!providedKey || !providedKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  // In production, query your database for the hashed key
  for (const [userId, userData] of apiKeys.entries()) {
    for (const keyData of userData.keys) {
      const isValid = await bcrypt.compare(providedKey, keyData.hashedKey);
      if (isValid) {
        return {
          userId,
          keyId: keyData.keyId,
          username: userData.username,
        };
      }
    }
  }

  return null;
}

/**
 * Middleware to authenticate requests using API key
 */
const authenticateApiKey = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const apiKey = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required',
    });
  }

  const userData = await validateApiKey(apiKey);
  if (!userData) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired API key',
    });
  }

  req.user = userData;
  next();
};

// Routes

/**
 * POST /register - Register a new user and generate their first API key
 */
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required',
      });
    }

    // Check if user already exists
    if (users.has(email)) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Create user ID
    const userId = crypto.randomUUID();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate initial API key
    const apiKeyData = await generateApiKey(userId, {
      prefix: API_KEY_PREFIX,
      includeTimestamp: true,
    });

    // Store user data (use a proper database in production)
    const userData = {
      userId,
      username,
      email,
      hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.set(email, userData);

    // Store API key data
    apiKeys.set(userId, {
      username,
      keys: [{
        keyId: apiKeyData.keyId,
        hashedKey: apiKeyData.hashedKey,
        createdAt: apiKeyData.createdAt,
        lastUsed: null,
        isActive: true,
      }],
    });

    // Generate JWT for session management
    const token = jwt.sign(
      { userId, username, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId,
        username,
        email,
        token,
        apiKey: {
          key: apiKeyData.rawKey, // Only time raw key is returned!
          keyId: apiKeyData.keyId,
          createdAt: apiKeyData.createdAt,
          warning: 'Store this API key securely. It will not be shown again.',
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during registration',
    });
  }
});

/**
 * POST /api-keys/generate - Generate a new API key for authenticated user
 */
app.post('/api-keys/generate', authenticateApiKey, async (req, res) => {
  try {
    const { userId, username } = req.user;

    // Check if user has reached the API key limit
    const userData = apiKeys.get(userId);
    const MAX_API_KEYS = 5;

    if (userData && userData.keys.length >= MAX_API_KEYS) {
      return res.status(429).json({
        success: false,
        error: `Maximum of ${MAX_API_KEYS} API keys allowed per user`,
      });
    }

    // Generate new API key
    const apiKeyData = await generateApiKey(userId, {
      prefix: API_KEY_PREFIX,
      includeTimestamp: true,
    });

    // Store new key
    if (userData) {
      userData.keys.push({
        keyId: apiKeyData.keyId,
        hashedKey: apiKeyData.hashedKey,
        createdAt: apiKeyData.createdAt,
        lastUsed: null,
        isActive: true,
      });
    }

    res.status(201).json({
      success: true,
      message: 'New API key generated successfully',
      data: {
        apiKey: {
          key: apiKeyData.rawKey,