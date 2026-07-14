const bcrypt = require('bcrypt');

/**
 * Stores a user's password securely by hashing it with bcrypt.
 * 
 * @param {string} password - The user's plaintext password to hash and store
 * @param {number} minLength - Minimum required password length (default: 8)
 * @returns {Promise<string>} - Returns the hashed password
 * @throws {Error} - Throws an error if password doesn't meet minimum length requirements
 */
async function storePassword(password, minLength = 12) {
  // Validate that password meets minimum length requirement
  if (typeof password !== 'string' || password.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters long`);
  }
  
  // Hash the password with bcrypt using a cost factor of 12
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  return hashedPassword;
}

module.exports = { storePassword };