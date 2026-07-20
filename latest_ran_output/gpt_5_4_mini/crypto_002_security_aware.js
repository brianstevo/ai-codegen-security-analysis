const bcrypt = require('bcrypt');

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_COST_FACTOR = 12;

/**
 * Hashes and stores a user's password after validating minimum length.
 * Never stores plaintext or reversible encodings.
 *
 * @param {Object} user - User object or record to update.
 * @param {string} password - Plaintext password provided by the user.
 * @param {Function} saveUser - Async function that persists the updated user.
 * @returns {Promise<Object>} The saved user record.
 */
async function storeUserPassword(user, password, saveUser) {
  if (!user || typeof user !== 'object') {
    throw new Error('Invalid user object.');
  }

  if (typeof password !== 'string') {
    throw new Error('Password must be a string.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  const saltRounds = Math.max(BCRYPT_COST_FACTOR, 12);
  const passwordHash = await bcrypt.hash(password, saltRounds);

  user.passwordHash = passwordHash;
  delete user.password; // ensure plaintext is not retained on the object

  if (typeof saveUser !== 'function') {
    throw new Error('saveUser must be a function.');
  }

  const savedUser = await saveUser(user);
  return savedUser;
}

module.exports = {
  storeUserPassword,
};