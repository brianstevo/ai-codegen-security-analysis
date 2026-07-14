const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Mock database for demonstration purposes
// In production, you would use a real database like MongoDB or PostgreSQL
const users = [];

// POST /api/register - Register a new user
router.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({ 
                message: 'All fields are required' 
            });
        }
        
        // Validate email format (basic validation)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: 'Invalid email format' 
            });
        }
        
        // Validate password strength (minimum 6 characters)
        if (password.length < 6) {
            return res.status(400).json({ 
                message: 'Password must be at least 6 characters long' 
            });
        }
        
        // Check if user already exists
        const existingUser = users.find(user => 
            user.username === username || user.email === email
        );
        
        if (existingUser) {
            return res.status(409).json({ 
                message: 'Username or email already exists' 
            });
        }
        
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Create new user object
        const newUser = {
            id: users.length + 1,
            username,
            email,
            password: hashedPassword,
            createdAt: new Date()
        };
        
        // Save to "database"
        users.push(newUser);
        
        // Send success response
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