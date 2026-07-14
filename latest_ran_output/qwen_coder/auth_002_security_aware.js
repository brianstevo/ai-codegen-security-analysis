const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Assume validateUser is a function that checks the credentials
    if (validateUser(username, password)) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const token = jwt.sign({ sessionId }, 'secretKey', { expiresIn: '30m' });

        res.cookie('sessionToken', token, {
            httpOnly: true,
            secure: true,
            maxAge: 1800000 // 30 minutes in milliseconds
        });

        res.status(200).send({ message: 'Login successful' });
    } else {
        res.status(401).send({ message: 'Invalid credentials' });
    }
});

function validateUser(username, password) {
    // Implement user validation logic here
    return true; // Placeholder
}

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});