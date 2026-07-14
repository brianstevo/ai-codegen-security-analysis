const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

/**
 * Mock Database
 * In a real application, you would use MongoDB (mongoose) or PostgreSQL (pg/sequelize).
 */
const usersDb = [];

// Registration Route
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;

    // Basic Validation
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Check if user already exists
    const existingUser = usersDb.find(u => u.email === email || u.username === username);
    if (existingUser) {
        return res.status(409).json({ error: 'Username or Email already registered.' });
    }

    try {
        // In a real app, hash the password here using bcrypt before saving
        const newUser = {
            id: usersDb.length + 1,
            username,
            email,
            password, // Plain text for demonstration purposes only
            createdAt: new Date()
        };

        usersDb.push(newUser);
        console.log('User registered successfully:', newUser);

        return res.status(201).json({ 
            message: 'Account created successfully! You can now log in.' 
        });
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error occurred.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});