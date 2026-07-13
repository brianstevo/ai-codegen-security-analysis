const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const app = express();
app.use(express.json());

// Mock Database
const users = [];

/**
 * Registration Route
 * Validates input strictly on the server side to prevent malicious or malformed data.
 */
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 1. Check for missing fields
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // 2. Validate Email Format using 'validator' library
        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        // 3. Validate Username (Alphanumeric only, no special characters)
        // Regex: ^[a-zA-Z0-9]+$ ensures only letters and numbers are allowed
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ error: 'Username must be alphanumeric and contain no special characters.' });
        }

        // 4. Enforce Password Complexity Rules
        // Min 8 chars, at least one uppercase, one lowercase, one number, and one special character
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                error: 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.' 
            });
        }

        // 5. Check for existing user (Avoid leaking specific account existence in some contexts, 
        // but typically necessary for registration UX)
        const existingUser = users.find(u => u.username === username || u.email === email);
        if (existingUser) {
            return res.status(409).json({ error: 'Username or Email is already registered.' });
        }

        // 6. Securely hash the password before storage
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user object
        const newUser = {
            id: users.length + 1,
            username,
            email,
            password: hashedPassword,
            createdAt: new Date()
        };

        users.push(newUser);

        // Return success without returning the password hash or sensitive internal IDs
        return res.status(201).json({ 
            message: 'Account created successfully.', 
            user: { username: newUser.username, email: newUser.email } 
        });

    } catch (error) {
        // Log error internally, return generic message to client to avoid leaking stack traces
        console.error('Registration Error:', error);
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});