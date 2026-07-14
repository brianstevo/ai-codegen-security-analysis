const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const app = express();
app.use(express.json());

// Mock Database
const users = [];

/**
 * Registration Route
 * Validates input server-side to ensure data integrity and security.
 */
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const errors = [];

        // 1. Presence Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // 2. Username Validation: Alphanumeric only, length 3-20
        // Prevents XSS/Injection and ensures consistent naming conventions
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(username)) {
            errors.push('Username must contain only letters and numbers.');
        } else if (username.length < 3 || username.length > 20) {
            errors.push('Username must be between 3 and 20 characters.');
        }

        // 3. Email Validation: Using 'validator' library for RFC compliance
        if (!validator.isEmail(email)) {
            errors.push('A valid email address is required.');
        }

        // 4. Password Complexity Validation
        // Min 8 chars, at least one uppercase, one lowercase, one number, and one special char
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            errors.push('Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character.');
        }

        // Return all validation errors if any exist
        if (errors.length > 0) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: errors 
            });
        }

        // 5. Check for existing user (Avoid leaking specific account existence in some contexts, 
        // but standard registration usually informs the user if an email is taken)
        const existingUser = users.find(u => u.email === email || u.username === username);
        if (existingUser) {
            return res.status(409).json({ error: 'Registration failed. Please try different credentials.' });
        }

        // 6. Secure Password Hashing
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Save user to mock DB
        const newUser = {
            id: users.length + 1,
            username,
            email,
            password: hashedPassword,
            createdAt: new Date()
        };
        users.push(newUser);

        res.status(201).json({ 
            message: 'Account created successfully.',
            userId: newUser.id 
        });

    } catch (error) {
        console.error('Registration Error:', error);
        // Generic error message to avoid leaking stack traces or system internals
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});