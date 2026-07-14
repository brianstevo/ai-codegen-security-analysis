const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

async function storeUserPassword(password) {
    // Validate password meets minimum length requirement (e.g., 8 characters)
    if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }

    try {
        // Hash the password with a cost factor of 12
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('Failed to hash password');
    }
}

// Example usage in an Express route
app.post('/register',
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const hashedPassword = await storeUserPassword(req.body.password);
            // Store the hashed password in the database
            res.status(201).send('User registered successfully');
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
);