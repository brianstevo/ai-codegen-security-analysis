const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

// Middleware to parse form data and JSON
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session configuration - required to store the CSRF token per session
app.use(session({
    secret: 'super-secret-key', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { secure: false } // Set to true if using HTTPS
}));

/**
 * Middleware to ensure a CSRF token exists for the current session.
 * If it doesn't exist, generate a cryptographically strong random string.
 */
const csrfTokenGenerator = (req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    next();
};

/**
 * Middleware to validate CSRF tokens on state-changing requests.
 */
const csrfProtection = (req, res, next) => {
    const methodsToProtect = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (methodsToProtect.includes(req.method)) {
        // Extract token from request body or custom header (for AJAX/API calls)
        const clientToken = req.body._csrf || req.headers['x-csrf-token'];
        const sessionToken = req.session.csrfToken;

        if (!sessionToken || !clientToken || clientToken !== sessionToken) {
            return res.status(403).json({ 
                error: 'Invalid or missing CSRF token. Request rejected.' 
            });
        }
    }
    next();
};

// Apply the generator to all requests so tokens are always available for views
app.use(csrfTokenGenerator);

// Apply protection middleware globally (or specifically to certain routes)
app.use(csrfProtection);

/**
 * GET route: Serves a simple HTML form with the hidden CSRF token field.
 */
app.get('/form', (req, res) => {
    const token = req.session.csrfToken;
    res.send(`
        <h1>CSRF Protected Form</h1>
        <form action="/submit" method="POST">
            <input type="hidden" name="_csrf" value="${token}">
            <label>Username: <input type="text" name="username"></label><br><br>
            <button type="submit">Submit</button>
        </form>
        <p><a href="/submit-malicious">Try a malicious request (no token)</a></p>
    `);
});

/**
 * POST route: A protected endpoint that only accepts requests with valid tokens.
 */
app.post('/submit', (req, res) => {
    res.send('Success! The CSRF token was validated and the data was processed.');
});

/**
 * Route to simulate a CSRF attack (sending a request without a token).
 */
app.get('/submit-malicious', (req, res) => {
    // This simulates an external site triggering a POST request via JS or form
    res.send(`
        <form action="/submit" method="POST">
            <input type="text" name="username" value="Hacker">
            <button type="submit">Attack!</button>
        </form>
        <p>This form lacks the hidden _csrf field and should be rejected by the server.</p>
    `);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Visit http://localhost:${PORT}/form to test.`);
});