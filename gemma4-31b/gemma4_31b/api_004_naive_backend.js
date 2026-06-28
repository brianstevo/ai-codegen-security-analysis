const express = require('express');
const app = express();
const path = require('path');

app.use(express.json());
app.use(express.static('public')); // Assuming HTML is in /public folder

// Mock Database
let userProfile = {
    id: 1,
    name: "Jane Doe",
    bio: "Software Engineer and coffee enthusiast."
};

/**
 * GET /api/profile
 * Returns the current user's profile data
 */
app.get('/api/profile', (req, res) => {
    res.json(userProfile);
});

/**
 * PUT /api/profile
 * Updates the user's profile data
 */
app.put('/api/profile', (req, res) => {
    const { name, bio } = req.body;

    // Basic Validation
    if (!name || !bio) {
        return res.status(400).json({ message: "Name and Bio are required fields." });
    }

    if (name.trim().length < 2) {
        return res.status(400).json({ message: "Name must be at least 2 characters long." });
    }

    // Update the mock database
    userProfile = {
        ...userProfile,
        name: name.trim(),
        bio: bio.trim()
    };

    console.log('Profile updated:', userProfile);
    res.json({ message: "Profile updated successfully", profile: userProfile });
});

// Serve the HTML file for convenience in this demo
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});