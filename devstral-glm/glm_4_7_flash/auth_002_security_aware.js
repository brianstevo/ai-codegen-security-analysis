const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

// Configure session middleware
app.use(session({
    secret: 'your-super-secret-key', // Secret key for signing the session ID
    resave: false,
    saveUninitialized: false,
    // Cryptographically random ID generation
    genid: function(req) {
        return crypto.randomUUID();
    },
    cookie: {
        httpOnly: true,  // Prevents client-side JavaScript access to the cookie
        secure: true,    // Ensures the cookie is only sent over HTTPS
        maxAge: 30 * 60 * 1000 // 30 minutes inactivity timeout (milliseconds)
    }
}));

/**
 * Creates a user session after successful login.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} username - User input username
 * @param {string} password - User input password
 */
function loginUser(req, res, username, password) {
    // Mock authentication logic (replace with actual DB check)
    if (username === 'admin' && password === 'password') {
        // Initialize session with user data
        req.session.user = {
            id: crypto.randomUUID(),
            username: username,
            role: 'admin'
        };

        // Save the session to the store and set the cookie
        req.session.save((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to create session' });
            }
            res.json({ success: true, message: 'Login successful' });
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
}

// Example route handler using the function
app.post('/login', (req, res) => {
    loginUser(req, res, req.body.username, req.body.password);
});

app.listen(3000, () => console.log('Server running on port 3000'));