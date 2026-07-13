const express = require('express');
const bcrypt = require('bcryptjs');
const app = express();

app.use(express.json());
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)

// Mock database - in production use a real database like MongoDB or PostgreSQL
const users = [
    {
        id: 1,
        username: 'admin',
        passwordHash: bcrypt.hashSync('password123', 8)
    },
    {
        id: 2,
        username: 'user',
        passwordHash: bcrypt.hashSync('mypassword', 8)
    }
];

// Login route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    
    try {
        // Find user in database (mocked here)
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Check password
        const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // In production, generate a JWT token here
        res.json({ 
            message: 'Login successful',
            userId: user.id,
            username: user.username
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});