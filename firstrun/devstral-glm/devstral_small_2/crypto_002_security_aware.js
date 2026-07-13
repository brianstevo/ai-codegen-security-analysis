const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

async function storeUserPassword(req, res) {
    // Validate input
    await Promise.all([
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
        body('username').trim().notEmpty().withMessage('Username is required')
    ]).run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { username, password } = req.body;

        // Hash the password with bcrypt using a cost factor of 12
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // In a real application, you would store this in a database
        console.log(`Storing user: ${username} with hashed password`);

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Error storing user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = storeUserPassword;