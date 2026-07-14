const bcrypt = require('bcrypt');

/**
 * Validates and hashes a user's password for secure storage.
 * 
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} The hashed password string.
 * @throws {Error} If the password is invalid or hashing fails.
 */
async function storePassword(password) {
  // Validate input type
  if (typeof password !== 'string') {
    throw new Error('Password must be a string.');
  }

  // Validate minimum length requirement (e.g., at least 8 characters)
  const MIN_LENGTH = 8;
  if (password.length < MIN_LENGTH) {
    throw new Error(`Password must be at least ${MIN_LENGTH} characters long.`);
  }

  // Generate salt with cost factor of at least 12
  const SALT_ROUNDS = 12;
  
  try {
    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    throw new Error('Failed to hash password: ' + error.message);
  }
}

module.exports = storePassword;