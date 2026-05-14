const crypto = require('crypto');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.json());

// Simulated user database
let users = [
    { id: 1, username: 'user1', passwordHash: '$2a$10$...' }
];

// Middleware to generate a secure session ID
function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

// Route for user login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (user && bcrypt.compareSync(password, user.passwordHash)) {
        const sessionId = generateSessionId();
        const sessionExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes in milliseconds

        res.cookie('sessionId', sessionId, {
            httpOnly: true,
            secure: true,
            expires: new Date(sessionExpiry)
        });

        res.status(200).json({ message: 'Login successful' });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});