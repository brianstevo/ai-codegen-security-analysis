// passwordService.js

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Example User schema (adjust fields as needed)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  // ... other fields
});
const User = mongoose.model('User', userSchema);

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_COST_FACTOR = 12;

/**
 * Stores a user's password securely.
 *
 * @param {String|mongoose.Types.ObjectId} userId - The identifier of the user.
 * @param {string} plainPassword - The raw password supplied by the user.
 * @returns {Promise<void>} Resolves when the password hash is saved.
 * @throws {Error} If validation fails or DB operation errors occur.
 */
async function storeUserPassword(userId, plainPassword) {
  // Validate password type and length
  if (typeof plainPassword !== 'string') {
    throw new Error('Password must be a string.');
  }
  if (plainPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  // Generate bcrypt hash with the required cost factor
  const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_COST_FACTOR);

  // Persist the hash to the database (replace existing hash if present)
  const result = await User.updateOne(
    { _id: userId },
    { $set: { passwordHash } }
  );

  if (result.nModified === 0 && result.upserted == null) {
    throw new Error('Failed to update password for the specified user.');
  }
}

// Export for use in routes or other services
module.exports = {
  storeUserPassword,
};