```javascript
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

// In-memory "database" for demonstration purposes
// In production, replace with a real database (e.g., PostgreSQL, MongoDB)
const db = {
  apiKeys: [], // { id, userId, hashedKey, prefix, label, createdAt, lastUsedAt, isActive }
  users: [
    {
      id: "user-001",
      username: "testuser",
      // bcrypt hash of "password123"
      passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VKnZ5LKQW",
    },
  ],
};

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const BCRYPT_ROUNDS = 12;
const KEY_BYTES = 32; // 32 bytes = 256 bits
const KEY_PREFIX_LENGTH = 8; // Visible prefix for identification (e.g., "sk_a1b2c3d4")

/**
 * Generates a cryptographically secure API key.
 * Returns the plaintext key (shown once) and a hashed version for storage.
 *
 * @param {string} encoding - "hex" or "base64url"
 * @returns {Promise<{plaintextKey: string, hashedKey: string, prefix: string}>}
 */
async function generateApiKey(encoding = "hex") {
  return new Promise((resolve, reject) => {
    // Generate cryptographically secure random bytes (minimum 32 bytes = 256 bits)
    crypto.randomBytes(KEY_BYTES, async (err, buffer) => {
      if (err) {
        return reject(new Error(`Failed to generate random bytes: ${err.message}`));
      }

      let encodedKey;
      if (encoding === "base64url") {
        // base64url encoding: URL-safe, no padding
        encodedKey = buffer.toString("base64url");
      } else {
        // hex encoding: 64 characters for 32 bytes
        encodedKey = buffer.toString("hex");
      }

      // Create a human-readable prefix for identification without exposing the full key
      // Format: "sk_<first 8 chars>" — allows users to identify keys without revealing secrets
      const prefix = `sk_${encodedKey.substring(0, KEY_PREFIX_LENGTH)}`;
      const plaintextKey = `${prefix}.${encodedKey}`;

      try {
        // Hash the full plaintext key using bcrypt for secure storage
        // Only the hash is stored — the plaintext key is NEVER persisted
        const hashedKey = await bcrypt.hash(plaintextKey, BCRYPT_ROUNDS);

        resolve({
          plaintextKey, // Return once to the user, never store this
          hashedKey,    // Store this in the database
          prefix,       // Store this for key identification/lookup
        });
      } catch (hashErr) {
        reject(new Error(`Failed to hash API key: ${hashErr.message}`));
      }
    });
  });
}

/**
 * Validates an incoming API key against stored hashes.
 * Uses constant-time comparison via bcrypt to prevent timing attacks.
 *
 * @param {string} plaintextKey - The key provided by the client
 * @returns {Promise<object|null>} - The API key record if valid, null otherwise
 */
async function validateApiKey(plaintextKey) {
  if (!plaintextKey || typeof plaintextKey !== "string") {
    return null;
  }

  // Extract prefix for efficient database lookup (avoid hashing all stored keys)
  const parts = plaintextKey.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const prefix = parts[0];

  // Find active keys matching the prefix (narrow down candidates)
  const candidates = db.apiKeys.filter(
    (k) => k.prefix === prefix && k.isActive === true
  );

  if (candidates.length === 0) {
    return null;
  }

  // Check each candidate using bcrypt (constant-time comparison)
  for (const keyRecord of candidates) {
    try {
      const isValid = await bcrypt.compare(plaintextKey, keyRecord.hashedKey);
      if (isValid) {
        // Update last used timestamp
        keyRecord.lastUsedAt = new Date().toISOString();
        return keyRecord;
      }
    } catch {
      // Continue checking other candidates on error
      continue;
    }
  }

  return null;
}

/**
 * Middleware to authenticate requests using JWT (for user-authenticated endpoints).
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization header with Bearer token required" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware to authenticate requests using an API key.
 */
async function authenticateApiKey(req, res, next) {
  // Support API key via header or query parameter
  const apiKey =
    req.headers["x-api-key"] ||
    req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({ error: "API key required (X-Api-Key header or api_key query param)" });
  }

  const keyRecord = await validateApiKey(apiKey);
  if (!keyRecord) {
    return res.status(401).json({ error: "Invalid or inactive API key" });
  }

  req.apiKeyRecord = keyRecord;
  next();
}

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Authenticate a user and return a JWT for subsequent authenticated requests.
 */
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = db.users.find((u) => u.username === username);
  if (!user) {
    // Use constant-time comparison even on failure to prevent user enumeration
    await bcrypt.compare(password, "$2b$12$invalidhashtopreventtimingattack000000000000000000000");
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "1h", issuer: "api-key-service" }
  );

  res.json({
    message: "Login successful",
    token,
    expiresIn: 3600,
  });
});

/**
 * POST /api-keys
 * Generate a new API key for the authenticated user.
 * The plaintext key is returned ONCE — it cannot be retrieved again.
 *
 * Body: { label?: string, encoding?: "hex" | "base64url" }
 */
app.post("/api-keys", authenticateJWT, async (req, res) => {
  const { label = "default", encoding = "hex" } = req.body;

  if (!["hex", "base64url"].includes(encoding)) {
    return res.status(400).json({ error: 'Encoding must be "hex" or "base64url"' });