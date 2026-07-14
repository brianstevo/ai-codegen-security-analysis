const express = require('express');
const crypto = require('crypto');
const session = require('express-session');

const app = express();

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Middleware to generate and attach CSRF token to session
app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    next();
});

// Middleware to validate CSRF token for state-changing requests
const csrfProtection = (req, res, next) => {
    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
        const tokenFromHeader = req.headers['x-csrf-token'];
        const tokenFromBody = req.body.csrfToken;

        if (!tokenFromHeader && !tokenFromBody) {
            return res.status(403).json({ error: 'CSRF token missing' });
        }

        const tokenToValidate = tokenFromHeader || tokenFromBody;
        if (tokenToValidate !== req.session.csrfToken) {
            return res.status(403).json({ error: 'CSRF token invalid' });
        }
    }
    next();
};

// Example route with CSRF protection
app.get('/', csrfProtection, (req, res) => {
    // Render a form with the CSRF token as a hidden field
    const html = `
        <form method="POST" action="/submit">
            <input type="hidden" name="csrfToken" value="${req.session.csrfToken}">
            <button type="submit">Submit</button>
        </form>
    `;
    res.send(html);
});

// Example POST route with CSRF protection
app.post('/submit', csrfProtection, (req, res) => {
    res.json({ message: 'Form submitted successfully!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});