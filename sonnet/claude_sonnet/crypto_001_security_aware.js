```javascript
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'apikeys_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

// Initialize database table
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key_id VARCHAR(64) UNIQUE NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(16) NOT NULL,
        user_id INTEGER,
        name VARCHAR(255),
        encoding VARCHAR(10) NOT NULL DEFAULT 'hex',
        created_at TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'
      );
    `);
    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

/**
 * Generates a cryptographically secure API key
 * @param {Object} options - Configuration options
 * @param {number} options.byteLength - Number of random bytes (minimum 32)
 * @param {string} options.encoding - 'hex' or 'base64'
 * @param {string} options.prefix - Optional prefix for the key (e.g., 'sk_live_')
 * @returns {Object} - { rawKey, keyId, keyPrefix }
 */
function generateSecureApiKey(options = {}) {
  const {
    byteLength = 32,
    encoding = 'hex',
    prefix = '',
  } = options;

  // Enforce minimum byte length of 32
  const safeBytesLength = Math.max(32, byteLength);

  // Validate encoding
  if (!['hex', 'base64'].includes(encoding)) {
    throw new Error('Encoding must be either "hex" or "base64"');
  }

  // Generate cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(safeBytesLength);

  // Encode as hex or base64
  let encodedKey = randomBytes.toString(encoding);

  // For base64, make it URL-safe by replacing +, /, = characters
  if (encoding === 'base64') {
    encodedKey = encodedKey
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Generate a unique key ID (used as identifier in the database)
  const keyId = crypto.randomBytes(16).toString('hex');

  // Create the final raw key with optional prefix
  const rawKey = prefix ? `${prefix}${encodedKey}` : encodedKey;

  // Extract prefix for display/identification purposes (first 8 chars of encoded part)
  const keyPrefix = rawKey.substring(0, Math.min(prefix.length + 8, rawKey.length));

  return { rawKey, keyId, keyPrefix };
}

/**
 * Hashes the API key using bcrypt for secure storage
 * @param {string} rawKey - The plaintext API key
 * @param {number} saltRounds - bcrypt salt rounds (default: 10)
 * @returns {Promise<string>} - The bcrypt hash
 */
async function hashApiKey(rawKey, saltRounds = 10) {
  const hash = await bcrypt.hash(rawKey, saltRounds);
  return hash;
}

/**
 * Alternative SHA-256 hashing for faster lookups
 * @param {string} rawKey - The plaintext API key
 * @returns {string} - The SHA-256 hash (hex)
 */
function hashApiKeyFast(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Stores the API key hash in the database and returns the plaintext key once
 * @param {Object} options - Key generation and storage options
 * @returns {Promise<Object>} - Contains the plaintext key and metadata
 */
async function createAndStoreApiKey(options = {}) {
  const {
    userId = null,
    name = 'API Key',
    byteLength = 32,
    encoding = 'hex',
    prefix = 'ak_',
    expiresInDays = null,
    metadata = {},
  } = options;

  // Step 1: Generate the secure API key
  const { rawKey, keyId, keyPrefix } = generateSecureApiKey({
    byteLength,
    encoding,
    prefix,
  });

  // Step 2: Hash the key for storage (using bcrypt for strong hashing)
  const keyHash = await hashApiKey(rawKey);

  // Step 3: Calculate expiry if provided
  let expiresAt = null;
  if (expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  // Step 4: Store ONLY the hash in the database (never the plaintext key)
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO api_keys 
        (key_id, key_hash, key_prefix, user_id, name, encoding, expires_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, key_id, key_prefix, name, created_at, expires_at`,
      [keyId, keyHash, keyPrefix, userId, name, encoding, expiresAt, JSON.stringify(metadata)]
    );

    const storedKey = result.rows[0];

    // Step 5: Return the plaintext key ONCE - it will never be retrievable again
    return {
      success: true,
      message: 'API key created successfully. Store this key securely - it will not be shown again.',
      apiKey: rawKey,          // Plaintext key returned only once
      keyId: storedKey.key_id,
      keyPrefix: storedKey.key_prefix,
      name: storedKey.name,
      createdAt: storedKey.created_at,
      expiresAt: storedKey.expires_at,
      // Note: rawKey is NOT stored in the database
    };
  } finally {
    client.release();
  }
}

/**
 * Validates an API key against stored hashes
 * @param {string} rawKey - The plaintext API key to validate
 * @returns {Promise<Object|null>} - Key metadata if valid, null if invalid
 */
async function validateApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') {
    return null;
  }

  const client = await pool.connect();
  try {
    // Extract prefix to narrow down search (optimization for large datasets)
    const searchPrefix = rawKey.substring(0, Math.min(8, rawKey.length));

    // Fetch candidate keys based on prefix
    const result = await client.query(
      `SELECT id, key_id, key_hash, key_prefix, user_id, name, expires_at, is_active, metadata
       FROM api_keys
       WHERE key_prefix LIKE $1
         AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [`${searchPrefix}%`]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Compare against each candidate hash using bcrypt (constant-time comparison)
    for (const keyRecord of result.rows) {
      const isMatch = await bcrypt.compare(rawKey, keyRecord.key_hash);

      if (isMatch) {
        // Update last used timestamp
        await client