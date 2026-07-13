const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();

// Middleware to parse cookies and body data
app.use(cookieParser('your-secret-key-here'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware to generate a cryptographically random CSRF token per session
app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        // Generate a 32-byte random token and convert to hex string
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    // Make the token available to the view engine (e.g., EJS)
    res.locals.csrfToken = req.session.csrfToken;
    next();
});

// Middleware to validate CSRF token on state-changing requests
app.use((req, res, next) => {
    const dangerousMethods = ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

    if (dangerousMethods.includes(req.method)) {
        let providedToken = null;

        // Attempt to extract token from JSON body
        if (req.body && typeof req.body === 'object') {
            providedToken = req.body._csrf || req.body.csrfToken;
        }

        // Attempt to extract token from URL-encoded body (HTML forms)
        if (!providedToken && req.body) {
            providedToken = req.body._csrf || req.body.csrfToken;
        }

        // If token is missing, reject the request
        if (!providedToken) {
            return res.status(403).json({ error: 'CSRF token is missing' });
        }

        // If token does not match the session token, reject the request
        if (providedToken !== req.session.csrfToken) {
            return res.status(403).json({ error: 'CSRF token validation failed' });
        }
    }

    next();
});

// Route: GET / - Renders a form (State-changing requests are not checked here)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>CSRF Protection Demo</title>
        </head>
        <body>
            <h1>CSRF Protected Form</h1>
            <form action="/submit" method="POST">
                <input type="hidden" name="_csrf" value="${res.locals.csrfToken}">
                <input type="text" name="data" placeholder="Enter data">
                <button type="submit">Submit</button>
            </form>
        </body>
        </html>
    `);
});

// Route: POST /submit - Handles form submission (CSRF validation is applied here)
app.post('/submit', (req, res) => {
    res.send(`Form submitted successfully with data: ${req.body.data}`);
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});