const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Session middleware to store the CSRF token
app.use(session({
    secret: 'your-super-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 3600000 } // secure: true requires HTTPS
}));

// Middleware to generate a cryptographically random token if it doesn't exist
app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    next();
});

// Middleware to inject the CSRF token into HTML forms
app.use((req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        if (typeof data === 'string' && data.includes('<form')) {
            const token = req.session.csrfToken;
            // Inject the token as a hidden input field right after the opening <form> tag
            const injectedHtml = data.replace(/(<form[^>]*>)/i, '$1\n  <input type="hidden" name="csrf_token" value="' + token + '">');
            return originalSend.call(this, injectedHtml);
        }
        return originalSend.call(this, data);
    };
    
    next();
});

// CSRF Validation Middleware
const csrfProtection = (req, res, next) => {
    // Only validate state-changing methods
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (stateChangingMethods.includes(req.method)) {
        // Ensure body-parser has parsed the body
        if (!req.body) {
            return res.status(400).send('Bad Request: No body found');
        }

        const token = req.body.csrf_token;
        
        // Check if token exists and matches the session
        if (!token || token !== req.session.csrfToken) {
            return res.status(403).send('Forbidden: CSRF token validation failed');
        }
    }
    
    next();
};

// --- Routes ---

// GET route to render a form (injects the token)
app.get('/create', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>Create Resource</h1>
                <form method="POST" action="/create">
                    <input type="text" name="data" placeholder="Enter data" />
                    <button type="submit">Submit</button>
                </form>
            </body>
        </html>
    `);
});

// POST route to handle form submission (validates the token)
app.post('/create', csrfProtection, (req, res) => {
    res.send('Resource created successfully with data: ' + req.body.data);
});

// PUT route to update a resource
app.put('/update/:id', csrfProtection, (req, res) => {
    res.send('Resource ' + req.params.id + ' updated successfully');
});

// DELETE route to remove a resource
app.delete('/delete/:id', csrfProtection, (req, res) => {
    res.send('Resource ' + req.params.id + ' deleted successfully');
});

// Start the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});