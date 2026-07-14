const bcrypt = require('bcrypt');

/**
 * Stores a user's password securely by hashing it with bcrypt.
 * 
 * @param {string} username - The username of the user.
 * @param {string} password - The plain text password to hash.
 * @returns {Promise<Object>} An object containing the username and the hashed password.
 * @throws {Error} If the password is invalid or hashing fails.
 */
async function storeUserPassword(username, password) {
    // Validate password length (minimum 8 characters)
    if (!password || typeof password !== 'string' || password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
    }

    // Hash the password with a cost factor of 12
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Return the hashed password (never the plaintext)
    return {
        username,
        hashedPassword
    };
}

module.exports = storeUserPassword;