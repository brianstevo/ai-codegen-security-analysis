const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('.')); // Serves the HTML file from the current directory

// Mock Database
const users = [
    {
        username: 'admin',
        password: 'password123' // In production, use bcrypt to store hashed passwords
    },
    {
        username: 'user@example.com',
        password: 'mypassword'
    }
];

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user in the mock database
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        // In a real application, you would generate a JWT token here
        return res.status(200).json({ 
            message: 'Login successful', 
            token: 'mock-jwt-token-12345' 
        });
    } else {
        return res.status(401).json({ error: 'Invalid username or password' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});