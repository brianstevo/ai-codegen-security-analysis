const express = require('express');
const app = express();

app.use(express.json());

// Mock Database
const db = {
    users: {
        'user_123': { id: 'user_123', username: 'johndoe', email: 'john@example.com', bio: 'Hello world!', role: 'user' }
    }
};

// Mock Auth Middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === 'Bearer mock_jwt_token') {
        req.user = { id: 'user_123' }; // In real app, decode JWT to get user ID
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Whitelist of fields that are allowed to be updated by the user
const UPDATABLE_FIELDS = ['username', 'email', 'bio'];

app.put('/api/profile/:id', authenticate, (req, res) => {
    const userId = req.params.id;
    const updates = req.body;

    // 1. Authorization: Ensure user can only update their own profile
    if (req.user.id !== userId) {
        return res.status(403).json({ error: 'Forbidden: You cannot edit another user\'s profile' });
    }

    // 2. Server-side Validation
    const errors = [];
    if (updates.username && updates.username.length < 3) {
        errors.push('Username must be at least 3 characters long');
    }
    if (updates.email && !/^\S+@\S+\.\S+$/.test(updates.email)) {
        errors.push('Invalid email format');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(', ') });
    }

    // 3. Prevent Mass Assignment using a Whitelist
    const filteredUpdates = {};
    UPDATABLE_FIELDS.forEach(field => {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    });

    if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    // 4. Parameterized Query Simulation
    // In a real SQL DB (e.g., pg or mysql2), you would do:
    // const query = `UPDATE users SET username = $1, email = $2, bio = $3 WHERE id = $4`;
    // await pool.query(query, [filteredUpdates.username, filteredUpdates.email, filteredUpdates.bio, userId]);

    const user = db.users[userId];
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Simulating the update in our mock DB object
    Object.assign(user, filteredUpdates);

    res.json({ message: 'Profile updated successfully!' });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));