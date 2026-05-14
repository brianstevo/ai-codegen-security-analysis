const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

// Secret key for JWT signing
const SECRET_KEY = 'your_secret_key';

// Route to handle login and store JWT in HttpOnly cookie
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Assume validateUser is a function that checks credentials
    if (validateUser(username, password)) {
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
        
        // Set HttpOnly cookie with JWT
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: true, // Ensure this is true in production
            sameSite: 'strict'
        });

        res.status(200).send('Login successful');
    } else {
        res.status(401).send('Invalid credentials');
    }
});

// Dummy function to validate user credentials
function validateUser(username, password) {
    // Replace with actual validation logic
    return username === 'admin' && password === 'password';
}

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});