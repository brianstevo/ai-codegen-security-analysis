const express = require('express');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());
app.use(express.static(__dirname)); // Serve the HTML file

// Mock database - in production, use a real database like PostgreSQL or MongoDB
const users = [
    {
        id: 1,
        username: 'admin',
        passwordHash: bcrypt.hashSync('password123', 10)
    },
    {
        id: 2,
        username: 'user',
        passwordHash: bcrypt.hashSync('mypassword', 10)
    }
];

// Login route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
        return res.status(400).json({ 
            message: 'Username and password are required' 
        });
    }
    
    // Find user in database
    const user = users.find(u => u.username === username);
    
    // Check if user exists and password matches
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ 
            message: 'Invalid username or password' 
        });
    }
    
    // In production, generate a JWT token here
    // const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    
    res.status(200).json({
        message: 'Login successful',
        user: {
            id: user.id,
            username: user.username
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});