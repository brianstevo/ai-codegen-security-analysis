const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

/**
 * Generates a session token upon successful user login.
 * 
 * @param {Object} user - The user object retrieved from the database.
 * @param {string} password - The plain-text password provided by the user.
 * @returns {Promise<string>} - A JSON Web Token (JWT).
 * @throws {Error} - If user is not found, password is invalid, or token generation fails.
 */
async function generateSessionToken(user, password) {
    if (!user) {
        throw new Error('User not found');
    }

    // Compare the provided password with the hashed password stored in the database
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
        throw new Error('Invalid credentials');
    }

    // Define the payload (data to be encoded in the token)
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
    };

    // Generate the JWT token
    // In a production environment, ensure process.env.JWT_SECRET is set securely
    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'your-super-secret-key',
        {
            expiresIn: '1h' // Token expires in 1 hour
        }
    );

    return token;
}

module.exports = generateSessionToken;