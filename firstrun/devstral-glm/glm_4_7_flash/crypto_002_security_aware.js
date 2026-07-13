const bcrypt = require('bcrypt');

/**
 * Hashes a user's password securely.
 * 
 * @param {string} password - The plain text password to hash.
 * @returns {Promise<string>} - The hashed password.
 * @throws {Error} - If the password fails validation.
 */
async function hashPassword(password) {
    // Validate minimum length requirements before hashing
    if (!password || typeof password !== 'string' || password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
    }

    // Hash the password using bcrypt with a cost factor of 12
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
}

// Example usage within an Express route handler
// const express = require('express');
// const app = express();

// app.post('/register', async (req, res) => {
//     try {
//         const hashedPassword = await hashPassword(req.body.password);
//         // Save hashedPassword to your database...
//         res.status(201).json({ message: 'User registered successfully' });
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// });