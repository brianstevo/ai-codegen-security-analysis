const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

const SECRET_KEY = 'your_super_secret_key';

// Mock Database
const users = [
    {
        id: 1,
        email: 'user@example.com',
        passwordHash: bcrypt.hashSync('password123', 10)
    }
];

/**
 * Helper to prevent Open Redirect vulnerabilities.
 * Ensures the redirect URL is a relative path and not an absolute external URL.
 */
const getSafeRedirectUrl = (url) => {
    if (!url) return '/dashboard';
    // Ensure the URL starts with '/' and NOT '//' (which can be used for protocol-relative redirects to other domains)
    if (url.startsWith('/') && !url.startsWith('//')) {
        return url;
    }
    return '/dashboard';
};

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const { redirect } = req.query; // Get the target URL from query string

        // 1. Find user
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 2. Verify password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 3. Generate JWT
        const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });

        // 4. Set token in an HTTP-only cookie for browser persistence during redirect
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000 // 1 hour
        });

        // 5. Determine safe redirection target
        const destination = getSafeRedirectUrl(redirect);

        // 6. Redirect the user
        return res.redirect(destination);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Mock protected route to test redirect
app.get('/dashboard', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).send('Unauthorized');
    res.send('Welcome to the Dashboard!');
});

// Mock specific page to test redirect
app.get('/profile', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).send('Unauthorized');
    res.send('Welcome to your Profile Page!');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Test Login: POST /login?redirect=/profile with body { "email": "user@example.com", "password": "password123" }`);
});