const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Mock Database
const users = []; 
const JWT_SECRET = 'your_super_secret_key_123';

/**
 * POST /api/register
 * Processes user registration form submission
 */
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 1. Basic Validation
        if (!username || !email || !password) {
            return res.status(400).json({ 
                error: 'Username, email, and password are required.' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters long.' 
            });
        }

        // 2. Check if user already exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(409).json({ 
                error: 'A user with this email already exists.' 
            });
        }

        // 3. Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. Create and store the new user
        const newUser = {
            id: users.length + 1,
            username,
            email,
            password: hashedPassword,
            createdAt: new Date()
        };

        users.push(newUser);

        // 5. Generate a JWT token for immediate login (Optional)
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email }, 
            JWT_SECRET, 
            { expiresIn: '1h' }
        );

        // 6. Return success response
        return res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email
            },
            token
        });

    } catch (error) {
        console.error('Registration Error:', error);
        return res.status(500).json({ 
            error: 'An internal server error occurred during registration.' 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});