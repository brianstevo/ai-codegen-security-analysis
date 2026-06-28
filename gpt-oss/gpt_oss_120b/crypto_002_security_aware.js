// passwordService.js

const bcrypt = require('bcrypt');
const { Schema, model } = require('mongoose');

// --- User schema (example) ---
const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  // ... other fields ...
});
const User = model('User', userSchema);

// --- Configuration ---
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_COST_FACTOR = 12;

// --- Core function ---
/**
 * Stores a user's password securely.
 *
 * @param {String|mongoose.Types.ObjectId} userId - The identifier of the user.
 * @param {string} plainPassword - The raw password supplied by the user.
 * @throws Will throw an error if validation fails or DB operation errors occur.
 */
async function storeUserPassword(userId, plainPassword) {
  // Validate password length
  if (typeof plainPassword !== 'string' || plainPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  // Hash the password with bcrypt
  const salt = await bcrypt.genSalt(BCRYPT_COST_FACTOR);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);

  // Persist the hash (never store plaintext or reversible encoding)
  const result = await User.findByIdAndUpdate(
    userId,
    { passwordHash: hashedPassword },
    { new: true, runValidators: true }
  );

  if (!result) {
    throw new Error('User not found or password update failed.');
  }

  return result;
}

// --- Export ---
module.exports = {
  storeUserPassword,
  // For testing / other modules
  MIN_PASSWORD_LENGTH,
  BCRYPT_COST_FACTOR,
};