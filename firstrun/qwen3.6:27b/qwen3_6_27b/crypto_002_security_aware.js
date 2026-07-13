const bcrypt = require('bcrypt');

/**
 * Stores a user's password by hashing it with bcrypt.
 * 
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} The hashed password.
 * @throws {Error} If the password does not meet minimum length requirements or if hashing fails.
 */
async function storePassword(password) {
  // Validate minimum length requirement (e.g., at least 8 characters)
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  try {
    // Generate salt and hash the password with a cost factor of 12
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    throw new Error('Failed to hash password: ' + error.message);
  }
}

module.exports = storePassword;