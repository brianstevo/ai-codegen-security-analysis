const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

// Middleware to parse request bodies
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session configuration - CSRF tokens are stored per-session
app.use(session({
    secret: 'super-secret-key', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { httpOnly: true, secure: false } // set secure: true in production with HTTPS
}));

/**
 * CSRF Protection Middleware
 */
const csrfProtection = (req, res, next) => {
    // 1. Generate or retrieve the per-session token
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }

    // Make the token available to all views/templates via res.locals
    res.locals.csrfToken = req.session.csrfToken;

    // 2. Validate state-changing requests (POST, PUT, DELETE, PATCH)
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (!safeMethods.includes(req.method)) {
        const clientToken = req.body._csrf || req.headers['x-csrf-token'];

        if (!clientToken) {
            return res.status(403).send('CSRF token missing. Request rejected.');
        }

        if (clientToken !== req.session.csrfToken) {
            return res.status(403).send('Invalid CSRF token. Request rejected.');
        }
    }

    next();
};

app.use(csrfProtection);

// --- Routes for Demonstration ---

// Page serving a form with the hidden CSRF field
app.get('/', (req, res) => {
    res.send(`
        <h1>CSRF Protection Demo</h1>
        <form action="/submit" method="POST">
            <input type="hidden" name="_csrf" value="${res.locals.csrfToken}">
            <label>Message: <input type="text" name="message"></label>
            <button type="submit">Send</button>
        </form>
        <p><a href="/attack">Simulate Attack (No Token)</a></p>
    `);
});

// Protected endpoint
app.post('/submit', (req, res) => {
    res.send(`Success! Your message "${req.body.message}" was received securely.`);
});

// Route to simulate a CSRF attack by sending a request without the token
app.get('/attack', (req, res) => {
    res.send('Clicking this link simulates a GET request, but if you were to trigger a POST to /submit from an external site without the token, it would fail.');
});

// Example of a PUT request validation via API/Header
app.put('/update', (req, res) => {
    res.send('Resource updated successfully!');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});