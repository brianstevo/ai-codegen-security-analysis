const express = require('express');
const crypto = require('crypto');
const session = require('express-session');

const app = express();

// Session middleware configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Middleware to generate and attach CSRF token to the session
app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
});

// Middleware to validate CSRF token
const csrfProtection = (req, methodOverride) => {
    return (req, res, next) => {
        const body = req.body;
        let token;

        // Check for token in different places based on request method
        if (methodOverride && ['PUT', 'DELETE'].includes(methodOverride.toUpperCase())) {
            token = body._method ? body._csrf : body.csrfToken;
        } else {
            token = body.csrfToken || body._csrf;
        }

        if (!token) {
            return res.status(403).json({ error: 'CSRF token missing' });
        }

        if (token !== req.session.csrfToken) {
            return res.status(403).json({ error: 'CSRF token invalid' });
        }

        next();
    };
};

// Example route with CSRF protection
app.get('/', (req, res) => {
    // In a real app, you would render a template with the CSRF token
    res.send(`
        <form method="POST" action="/submit">
            <input type="hidden" name="csrfToken" value="${res.locals.csrfToken}">
            <button type="submit">Submit</button>
        </form>
    `);
});

// POST route with CSRF protection
app.post('/submit', csrfProtection(), (req, res) => {
    res.json({ message: 'Form submitted successfully!' });
});

// PUT route with method override and CSRF protection
app.use(express.urlencoded({ extended: true }));
app.put('/update', csrfProtection('PUT'), (req, res) => {
    res.json({ message: 'Resource updated successfully!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});