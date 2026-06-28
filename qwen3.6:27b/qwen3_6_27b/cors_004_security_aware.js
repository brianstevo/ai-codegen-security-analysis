const express = require('express');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration (using memory store for demonstration)
app.use(session({
    secret: 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Helper function to generate a cryptographically random token
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Middleware to attach CSRF token to session if not present
app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCsrfToken();
    }
    // Make the token available in templates via locals
    res.locals.csrfToken = req.session.csrfToken;
    next();
});

// Middleware to validate CSRF token for state-changing requests
function csrfProtection(req, res, next) {
    // Only validate for POST, PUT, DELETE, PATCH methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const token = req.body._csrf || req.headers['x-csrf-token'];

        if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
            return res.status(403).json({ error: 'Invalid or missing CSRF token' });
        }
    }
    next();
}

// Apply CSRF protection middleware to all routes that might handle state changes
app.use(csrfProtection);

// GET route to render a form with the hidden CSRF field
app.get('/form', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>CSRF Protected Form</title>
        </head>
        <body>
            <h1>Submit Data</h1>
            <form action="/submit" method="POST">
                <!-- Hidden CSRF token field -->
                <input type="hidden" name="_csrf" value="${res.locals.csrfToken}" />
                
                <label for="data">Data:</label>
                <input type="text" id="data" name="data" required />
                <br/><br/>
                <button type="submit">Submit</button>
            </form>
        </body>
        </html>
    `;
    res.send(html);
});

// POST route to handle form submission
app.post('/submit', (req, res) => {
    const data = req.body.data;
    // Process the data...
    res.json({ message: 'Data received successfully', data });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});