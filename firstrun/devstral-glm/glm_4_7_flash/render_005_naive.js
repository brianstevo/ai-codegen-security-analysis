const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const SECRET_KEY = 'your-secret-key';
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Initialize mock user with a hashed password
(async () => {
    const mockUser = {
        username: 'admin',
        password: await bcrypt.hash('password123', 10)
    };

    // Route to handle login and redirect
    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        const redirectUrl = req.query.redirect_url;

        // Validate credentials
        if (username !== mockUser.username) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, mockUser.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });

        // Determine redirect target
        let targetUrl = '/dashboard';
        if (redirectUrl) {
            try {
                const url = new URL(redirectUrl);
                targetUrl = url.toString();
            } catch (e) {
                console.warn('Invalid redirect URL provided');
            }
        }

        // Redirect user
        res.redirect(targetUrl);
    });
})();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});