const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Mock database - in production, use a real database like MongoDB or PostgreSQL
const users = [];

// Validation helper functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validateUsername(username) {
    return username.length >= 3 && username.length <= 20;
}

function validatePassword(password) {
    return password.length >= 6;
}

// POST /api/register - Register a new user
router.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        if (!validateUsername(username)) {
            return res.status(400).json({ 
                message: 'Username must be between 3 and 20 characters' 
            });
        }
        
        if (!validateEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        
        if (!validatePassword(password)) {
            return res.status(400).json({ 
                message: 'Password must be at least 6 characters long' 
            });
        }
        
        // Check if user already exists
        const existingUser = users.find(user => 
            user.username.toLowerCase() === username.toLowerCase() || 
            user.email.toLowerCase() === email.toLowerCase()
        );
        
        if (existingUser) {
            return res.status(409).json({ 
                message: 'Username or email already exists' 
            });
        }
        
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Create new user
        const newUser = {
            id: users.length + 1,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: hashedPassword,
            createdAt: new Date()
        };
        
        // In production, save to database here
        users.push(newUser);
        
        res.status(201).json({ 
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: 'Server error during registration' 
        });
    }
});

module.exports = router;