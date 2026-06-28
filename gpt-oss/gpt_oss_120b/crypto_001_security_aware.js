// apiKeyService.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { promisify } = require('util');

// Adjust these values as needed
const KEY_BYTE_LENGTH = 32;          // 32 random bytes => 64 hex chars / 44 base64 chars
const SALT_ROUNDS = 12;              // bcrypt cost factor

/**
 * Generates a cryptographically secure API key, hashes it,
 * stores the hash in the database (via provided storeFn),
 * and returns the plaintext key.
 *
 * @param {string|number} ownerId - Identifier for the entity owning the key.
 * @param {(ownerId:string|number, hashedKey:string)=>Promise<any>} storeFn
 *        Async function that persists the hashed key. Must resolve when done.
 * @returns {Promise<string>} The plaintext API key (only shown once).
 */
async function generateAndStoreApiKey(ownerId, storeFn) {
  // 1️⃣ Generate random bytes and encode as a URL‑safe base64 string
  const rawKey = crypto.randomBytes(KEY_BYTE_LENGTH);
  const apiKey = rawKey.toString('base64url'); // e.g., "3vJ9..."; safe for URLs & headers

  // 2️⃣ Hash the key with bcrypt (never store plaintext)
  const hashedKey = await bcrypt.hash(apiKey, SALT_ROUNDS);

  // 3️⃣ Persist the hash (implementation‑specific)
  await storeFn(ownerId, hashedKey);

  // 4️⃣ Return the plaintext key to the caller (once!)
  return apiKey;
}

/* -------------------------------------------------------------------------- */
/* Example integration with an Express route and a mock DB model               */

const express = require('express');
const app = express();
app.use(express.json());

// Mock DB model – replace with your real ORM/ODM logic
const ApiKeyModel = {
  // Simulated storage (in‑memory)
  _store: new Map(),
  async create({ ownerId, hashedKey }) {
    const id = crypto.randomUUID();
    this._store.set(id, { ownerId, hashedKey });
    return { id, ownerId };
  },
  // For verification later
  async findByHashedKey(hashedKey) {
    for (const [id, rec] of this._store.entries()) {
      if (rec.hashedKey === hashedKey) return { id, ...rec };
    }
    return null;
  },
};

// Helper that matches the signature expected by generateAndStoreApiKey
async function storeHashedKey(ownerId, hashedKey) {
  await ApiKeyModel.create({ ownerId, hashedKey });
}

// Route: create a new API key for an authenticated user (simplified)
app.post('/api/keys', async (req, res) => {
  try {
    // In real code, derive `ownerId` from auth middleware
    const ownerId = req.body.ownerId;
    if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

    const apiKey = await generateAndStoreApiKey(ownerId, storeHashedKey);
    // Return only the plaintext key; never expose the hash again
    res.status(201).json({ apiKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

/* -------------------------------------------------------------------------- */
/* Verification helper – compare a presented key with stored hash            */
async function verifyApiKey(presentedKey, hashedKey) {
  return bcrypt.compare(presentedKey, hashedKey);
}

/* -------------------------------------------------------------------------- */
/* Server start (for demo purposes)                                           */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API key service listening on :${PORT}`));

module.exports = {
  generateAndStoreApiKey,
  verifyApiKey,
};