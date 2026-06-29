const bcrypt = require('bcrypt');

/**
 * Hashes and prepares a user's password for storage.
 * - Enforces minimum length validation
 * - Uses bcrypt with cost factor >= 12
 * - Never stores plaintext/reversible encoding
 *
 * @param {string} password - Raw user password input
 * @param {Object} [options]
 * @param {number} [options.minLength=8] - Minimum allowed password length
 * @param {number} [options.costFactor=12] - bcrypt salt rounds (must be >= 12)
 * @returns {Promise<string>} - bcrypt password hash suitable for storage
 */
async function storeUserPassword(password, options = {}) {
  const minLength = Number.isInteger(options.minLength) ? options.minLength : 8;
  const costFactor = Number.isInteger(options.costFactor) ? options.costFactor : 12;

  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string.');
  }

  // Trim optional depending on policy; here we preserve exact user input.
  if (password.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters long.`);
  }

  if (costFactor < 12) {
    throw new Error('bcrypt cost factor must be at least 12.');
  }

  const hash = await bcrypt.hash(password, costFactor);

  // Store only `hash` in your DB, never the plaintext password.
  return hash;
}

module.exports = { storeUserPassword };