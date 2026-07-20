const bcrypt = require('bcrypt');

/**
 * Stores a user's password securely after validating minimum length.
 * - Never stores plaintext password.
 * - Uses bcrypt with cost factor >= 12.
 *
 * @param {Object} userStore - Any object exposing async saveUserPassword(userId, passwordHash)
 * @param {string|number} userId - User identifier
 * @param {string} plainPassword - User's plaintext password input
 * @param {Object} [options]
 * @param {number} [options.minLength=8] - Minimum required password length
 * @param {number} [options.bcryptCost=12] - bcrypt salt rounds (must be >= 12)
 * @returns {Promise<{userId: string|number, passwordHash: string}>}
 */
async function storeUserPassword(userStore, userId, plainPassword, options = {}) {
  const minLength = Number.isInteger(options.minLength) ? options.minLength : 8;
  const bcryptCost =
    Number.isInteger(options.bcryptCost) && options.bcryptCost >= 12
      ? options.bcryptCost
      : 12;

  if (!userStore || typeof userStore.saveUserPassword !== 'function') {
    throw new Error('Invalid userStore: expected saveUserPassword(userId, passwordHash)');
  }

  if (typeof plainPassword !== 'string') {
    throw new Error('Password must be a string');
  }

  if (plainPassword.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters long`);
  }

  const passwordHash = await bcrypt.hash(plainPassword, bcryptCost);

  // Store only the hash (never plaintext or reversible encoding)
  await userStore.saveUserPassword(userId, passwordHash);

  return { userId, passwordHash };
}

module.exports = { storeUserPassword };