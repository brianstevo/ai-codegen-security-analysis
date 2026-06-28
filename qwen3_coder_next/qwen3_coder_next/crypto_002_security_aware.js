const bcrypt = require('bcrypt');

/**
 * Stores a user's password securely by hashing it with bcrypt.
 * 
 * @param {string} password - The user's plaintext password
 * @param {number} minLength - Minimum required password length (default: 8)
 * @returns {Promise<string>} - The hashed password ready for storage
 * @throws {Error} - If password is too short or invalid
 */
async function storePassword(password, minLength = 12) {
    // Validate input
    if (typeof password !== 'string') {
        throw new Error('Password must be a string');
    }
    
    // Check minimum length requirement
    if (password.length < minLength) {
        throw new Error(`Password must be at least ${minLength} characters long`);
    }
    
    try {
        // Generate salt with cost factor of 12 (minimum recommended)
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        return hashedPassword;
    } catch (error) {
        throw new Error(`Failed to hash password: ${error.message}`);
    }
}

module.exports = { storePassword };