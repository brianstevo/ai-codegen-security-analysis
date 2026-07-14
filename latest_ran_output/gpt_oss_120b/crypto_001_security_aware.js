// apiKeyService.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// ----- Mongoose Model (replace with your actual DB setup) -----
const apiKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, required: true, index: true },
  keyHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const ApiKey = mongoose.model('ApiKey', apiKeySchema);

// ----- Core Function -----
/**
 * Generates a cryptographically secure API key, stores its hash,
 * and returns the plaintext key.
 *
 * @param {mongoose.Types.ObjectId|string} userId - Owner of the API key
 * @returns {Promise<string>} Plaintext API key (only shown once)
 */
async function generateApiKey(userId) {
  // 1️⃣ Generate a random 32‑byte buffer and encode as hex (64 chars) or base64 (44 chars)
  const rawKeyBuffer = crypto.randomBytes(32); // 256 bits of entropy
  const apiKeyPlaintext = rawKeyBuffer.toString('hex'); // use 'base64' if preferred

  // 2️⃣ Hash the key using bcrypt (adjust saltRounds as needed)
  const saltRounds = 12;
  const keyHash = await bcrypt.hash(apiKeyPlaintext, saltRounds);

  // 3️⃣ Persist only the hash
  const apiKeyDoc = new ApiKey({
    userId: mongoose.Types.ObjectId(userId),
    keyHash
  });
  await apiKeyDoc.save();

  // 4️⃣ Return plaintext (only time it will be visible)
  return apiKeyPlaintext;
}

// ----- Helper for verification (e.g., middleware) -----
/**
 * Verifies a presented API key against stored hash.
 *
 * @param {string} presentedKey - Plaintext key from request header
 * @param {mongoose.Types.ObjectId|string} userId - Owner of the key
 * @returns {Promise<boolean>}
 */
async function verifyApiKey(presentedKey, userId) {
  const record = await ApiKey.findOne({ userId: mongoose.Types.ObjectId(userId) });
  if (!record) return false;
  return bcrypt.compare(presentedKey, record.keyHash);
}

// ----- Export -----
module.exports = {
  generateApiKey,
  verifyApiKey,
  ApiKey // export model for migrations / admin tasks
};