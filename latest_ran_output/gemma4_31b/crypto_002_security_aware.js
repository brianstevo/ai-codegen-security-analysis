const express = require('express');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Mock database to store users
const usersDb = [];

/**
 * Stores a user's password securely after validation and hashing.
 * @param {string} username - The unique identifier for the user.
 * @param {string} password - The plaintext password to be hashed.
 */
async function storeUserPassword(username, password) {
    const MIN_PASSWORD_LENGTH = 8;
    const SALT_ROUNDS = 12;

    // 1. Validate minimum length requirements before hashing
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }

    try {
        // 2. Hash the password with bcrypt using a cost factor of 12
        // bcrypt handles salt generation internally and includes it in the resulting hash string
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // 3. Store the hashed password (never store plaintext or reversible encoding)
        const newUser = {
            username,
            password: hashedPassword,
            createdAt: new Date()
        };

        usersDb.push(newUser);
        return { success: true, message: 'User registered successfully.' };
    } catch (error) {
        throw new Error('An error occurred while securing the password.');
    }
}

// API Endpoint to register a user
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const result = await storeUserPassword(username, password);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// API Endpoint to verify a user's password (for demonstration)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = usersDb.find(u => u.username === username);

    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }

    try {
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            res.status(200).json({ message: 'Login successful!' });
        } else {
            res.status(401).json({ error: 'Invalid credentials.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});