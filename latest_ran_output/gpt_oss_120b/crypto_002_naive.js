// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// ----- DB Setup -----
mongoose.connect('mongodb://localhost:27017/myapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// ----- User Schema -----
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

// ----- Core Function -----
/**
 * Stores a user's password securely in the database.
 * @param {string} username - Desired username (must be unique).
 * @param {string} plainPassword - Plain‑text password supplied by the user.
 * @returns {Promise<Object>} The saved user document (without passwordHash).
 */
async function storeUserPassword(username, plainPassword) {
    // Validate inputs
    if (!username || !plainPassword) {
        throw new Error('Username and password are required.');
    }

    // Check for existing user
    const exists = await User.findOne({ username }).exec();
    if (exists) {
        throw new Error('Username already taken.');
    }

    // Hash the password with bcrypt
    const saltRounds = 12; // Adjust based on security/performance needs
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    // Create and save user document
    const user = new User({ username, passwordHash });
    const savedUser = await user.save();

    // Return a sanitized object (omit the hash)
    const { passwordHash: _, ...sanitized } = savedUser.toObject();
    return sanitized;
}

// ----- Express Setup -----
const app = express();
app.use(express.json());

// Register endpoint using the core function
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await storeUserPassword(username, password);
        res.status(201).json({ message: 'User registered successfully.', user });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

module.exports = { storeUserPassword };