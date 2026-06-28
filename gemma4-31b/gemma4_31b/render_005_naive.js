const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const SECRET_KEY = 'your_super_secret_key';
// Mock database
const users = [
    { 
        id: 1, 
        username: 'admin', 
        passwordHash: bcrypt.hashSync('password123', 10) 
    }
];

/**
 * Helper to prevent Open Redirect vulnerabilities.
 * Ensures the redirect URL is a relative path or belongs to an allowed domain.
 */
const validateRedirectUrl = (url) => {
    if (!url) return '/dashboard'; // Default fallback
    
    // Only allow relative paths starting with '/' and not '//' (to prevent protocol-relative URLs)
    if (url.startsWith('/') && !url.startsWith('//')) {
        return url;
    }

    // Alternatively, check against a whitelist of allowed domains here
    const allowedDomains = ['https://myapp.com', 'https://api.myapp.com'];
    try {
        const parsedUrl = new URL(url);
        if (allowedDomains.includes(parsedUrl.origin)) {
            return url;
        }
    } catch (e) {
        // Invalid absolute URL
    }

    return '/dashboard'; // Default fallback for unsafe URLs
};

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const { redirect } = req.query;

    try {
        // 1. Find user
        const user = users.find(u => u.username === username);
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

        // 4. Set token in a secure cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict'
        });

        // 5. Handle the redirect logic
        const safeRedirectUrl = validateRedirectUrl(redirect);
        
        // Since this is a POST request usually handled by a frontend, 
        // we can either send the URL in the response body or perform a server-side redirect.
        // For a traditional form submission:
        return res.redirect(safeRedirectUrl);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});