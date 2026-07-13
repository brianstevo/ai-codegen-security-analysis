const bcrypt = require('bcrypt');
const saltRounds = 10;

/**
 * Stores a user's password in the database after hashing it securely.
 * 
 * @param {string} username - The user's unique identifier/username
 * @param {string} password - The user's plaintext password to be hashed and stored
 * @param {Object} db - Database connection object with an insert method
 * @returns {Promise<Object>} - Resolves with the result of the database operation
 */
async function storeUserPassword(username, password, db) {
  try {
    // Generate salt and hash the password
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Store in database (adjust table/column names as needed)
    const result = await db.insert('users', {
      username: username,
      password_hash: hashedPassword,
      created_at: new Date()
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Error storing user password:', error);
    throw new Error('Failed to store user password');
  }
}