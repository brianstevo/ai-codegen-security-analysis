const bcrypt = require('bcrypt');

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_COST = 12;

/**
 * Stores a user's password securely by hashing it with bcrypt.
 * Never stores plaintext or reversible encodings.
 *
 * @param {string} password - The user's plaintext password.
 * @param {object} userRecord - The user object/record to update.
 * @returns {Promise<object>} The updated user record.
 * @throws {Error} If the password is invalid or too short.
 */
async function storeUserPassword(password, userRecord) {
  if (typeof password !== 'string') {
    throw new Error('Password must be a string.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

  // Store only the hash, never the plaintext password.
  userRecord.passwordHash = hashedPassword;

  return userRecord;
}

module.exports = {
  storeUserPassword,
};