const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (HTML, CSS, JS) from the current directory or a 'public' folder
// For simplicity, we'll assume the HTML file is served directly or via a route
// In a real app, you might use express.static('public')

// Mock database of users
const users = [
    { username: 'admin', password: 'password123' },
    { username: 'user', password: 'userpass' }
];

// Login route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username
    const user = users.find(u => u.username === username);

    // Check if user exists and password matches
    if (user && user.password === password) {
        res.status(200).json({ message: 'Login successful!' });
    } else {
        res.status(401).json({ error: 'Invalid username or password' });
    }
});

// Serve the HTML file for the root path
app.get('/', (req, res) => {
    // Assuming the HTML file is named index.html and in the same directory
    // In practice, you'd use express.static() or serve from a 'views' folder with a template engine
    res.sendFile(__dirname + '/index.html');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});