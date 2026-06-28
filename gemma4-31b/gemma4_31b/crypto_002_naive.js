const express = require('express');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());

// Mock Database
const usersDb = [];

/**
 * Stores a user's password securely in the database.
 * 1. Salts and hashes the plain-text password using bcrypt.
 * 2. Saves the hashed version to the data store.
 */
async function saveUserToDatabase(username, plainTextPassword) {
    try {
        // Generate a salt and hash the password
        // Cost factor 10 is generally considered a good balance between security and performance
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(plainTextPassword, saltRounds);

        // Store user object in database
        const newUser = {
            id: usersDb.length + 1,
            username: username,
            password: hashedPassword // Never store plain-text passwords
        };

        usersDb.push(newUser);
        return { success: true, userId: newUser.id };
    } catch (error) {
        throw new Error('Error securing password: ' + error.message);
    }
}

// API Endpoint to register a user
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const result = await saveUserToDatabase(username, password);
        res.status(201).json({ message: 'User registered successfully', userId: result.userId });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API Endpoint to verify a password (for demonstration of how to use the stored hash)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = usersDb.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    try {
        // Compare the provided plain-text password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.status(200).json({ message: 'Login successful' });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});