const express = require('express');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public')); // Assuming HTML is in /public folder

// Mock Database
const users = [];

/**
 * POST /api/register
 * Handles user registration, password hashing and validation
 */
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 1. Basic Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // 2. Check if user already exists
        const existingUser = users.find(u => u.email === email || u.username === username);
        if (existingUser) {
            return res.status(409).json({ error: 'Username or Email already taken.' });
        }

        // 3. Password Hashing
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. Save to "Database"
        const newUser = {
            id: Date.now(),
            username,
            email,
            password: hashedPassword
        };
        users.push(newUser);

        console.log('User registered successfully:', newUser.username);
        
        return res.status(201).json({ 
            message: 'Account created successfully!' 
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});