const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { URL } = require('url');

const app = express();
app.use(express.json());

const SECRET_KEY = 'your-super-secret-key';
const TRUSTED_DOMAINS = ['trusted-app.com', 'auth.trusted-app.com'];

/**
 * Validates if a URL is safe to redirect to.
 * Prevents Open Redirect attacks by ensuring the target is either:
 * 1. A relative path (starts with / but not //)
 * 2. An absolute URL belonging to a whitelisted domain.
 */
const isValidRedirect = (urlStr) => {
    if (!urlStr) return false;

    // Check if it's a relative path
    // Must start with / and NOT start with // (which is a protocol-relative URL)
    if (urlStr.startsWith('/') && !urlStr.startsWith('//')) {
        return true;
    }

    try {
        const parsedUrl = new URL(urlStr);
        // Only allow specific protocols to prevent javascript: or data: schemes
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return false;
        }
        // Check if the hostname is in our whitelist
        return TRUSTED_DOMAINS.includes(parsedUrl.hostname);
    } catch (e) {
        // If URL parsing fails, it's not a valid absolute URL
        return false;
    }
};

// Mock User Database
const users = [
    { 
        id: 1, 
        username: 'admin', 
        passwordHash: bcrypt.hashSync('password123', 10) 
    }
];

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const returnTo = req.query.returnTo;

    try {
        const user = users.find(u => u.username === username);
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });

        // Set token in a secure cookie
        res.cookie('session_token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'Lax' 
        });

        // Handle Redirection Logic
        if (returnTo && isValidRedirect(returnTo)) {
            return res.redirect(returnTo);
        }

        // Default fallback redirect if returnTo is missing or invalid
        return res.redirect('/dashboard');
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});