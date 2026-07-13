const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Simulated Database (In-memory for demonstration)
// In a real application, this would be a SQL database like PostgreSQL or MongoDB
let currentUser = {
    id: 1,
    name: "John Doe",
    bio: "Front-end developer and coffee enthusiast."
};

// PUT Route to update user profile
app.put('/api/profile', (req, res) => {
    const { name, bio } = req.body;

    // Basic validation
    if (!name || !bio) {
        return res.status(400).json({ error: 'Name and bio are required.' });
    }

    // Simulate a database query
    // Example SQL: UPDATE users SET name = ?, bio = ? WHERE id = ?
    currentUser.name = name;
    currentUser.bio = bio;

    // Return success response
    res.json({
        message: 'Profile updated successfully',
        user: currentUser
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});