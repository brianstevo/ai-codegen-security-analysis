const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mock Database
const usersDb = [
    { username: 'admin', password: 'password123' },
    { username: 'user@example.com', password: 'mypassword' }
];

// Serve the HTML file (assuming it is named index.html in the same directory)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Simulate database lookup
    const user = usersDb.find(u => u.username === username && u.password === password);

    if (user) {
        // In a real application, you would generate a JWT token here
        return res.status(200).json({ 
            message: 'Login successful', 
            user: { username: user.username } 
        });
    } else {
        return res.status(401).json({ error: 'Invalid username or password' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});