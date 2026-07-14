const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (HTML/CSS/JS) from the current directory or a 'public' folder
// For this example, assuming the HTML file is served directly or via a simple route
// In a real app, you might use express.static('public')
app.get('/', (req, res) => {
    // This assumes you have an index.html file in your root or public directory
    // If running this script directly, you'd need to serve the HTML file properly.
    // For demonstration purposes, we focus on the API route below.
    res.send('Server is running. Visit /api/register endpoint documentation.');
});

// Mock Database (In-memory array for demonstration)
// In a production environment, replace this with MongoDB, PostgreSQL, etc.
const users = [];

// Registration Route
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Basic Validation
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Check if user already exists (Mock DB check)
        const existingUser = users.find(user => user.email === email);
        if (existingUser) {
            return res.status(409).json({ message: 'Email already registered.' });
        }

        // In a real app, you would hash the password here using bcrypt
        // const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user object
        const newUser = {
            id: users.length + 1,
            username,
            email,
            password: password // Note: Never store plain text passwords in production!
        };

        // Save to mock database
        users.push(newUser);

        // Respond with success
        res.status(201).json({ 
            message: 'User registered successfully.', 
            user: { id: newUser.id, username: newUser.username, email: newUser.email } 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});