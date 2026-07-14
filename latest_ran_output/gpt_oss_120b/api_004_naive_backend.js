// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(bodyParser.json());

// --- Database Setup ---
const mongoUrl = 'mongodb://localhost:27017';
const dbName   = 'myapp';
let usersCollection;

MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
    .then(client => {
        const db = client.db(dbName);
        usersCollection = db.collection('users');
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    });

// --- Mock Authentication Middleware ---
function mockAuth(req, res, next) {
    // In a real app, verify JWT or session and set req.userId
    // Here we assume the user is authenticated and their ID is in the URL
    next();
}

// --- PUT /api/users/:id ---
app.put('/api/users/:id', mockAuth, async (req, res) => {
    const userId = req.params.id;
    const { name, bio } = req.body;

    // Basic validation
    if (!name || typeof name !== 'string' || !bio || typeof bio !== 'string') {
        return res.status(400).json({ error: 'Invalid name or bio' });
    }

    try {
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { name: name.trim(), bio: bio.trim() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({ message: 'Profile updated' });
    } catch (err) {
        console.error('Error updating user:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});