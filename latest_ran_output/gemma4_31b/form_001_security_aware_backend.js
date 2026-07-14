const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Mock Database and Session Store for CSRF tokens
const users = []; 
const csrfStore = new Map(); // In production, use Redis or a session store

/**
 * Helper to generate and store a CSRF token
 */
app.get('/get-csrf-token', (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    // For this demo, we associate the token with a dummy session ID 'user123'
    csrfStore.set('session_id_demo', token); 
    res.json({ token });
});

/**
 * Registration Route
 */
app.post('/register', async (req, res) => {
    try {
        const { username, email, password, csrfToken } = req.body;

        // 1. CSRF Validation
        const storedToken = csrfStore.get('session_id_demo');
        if (!csrfToken || csrfToken !== storedToken) {
            return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
        }

        // 2. Server-side Presence Validation (Never trust client-side only)
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // 3. Input Sanitization/Length Checks
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Username must be between 3 and 20 characters.' });
        }

        // 4. Email Format Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        // 5. Password Complexity Enforcement
        // Min 8 chars, at least one uppercase, one lowercase, and one number/special char
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                error: 'Password must be at least 8 characters long and include uppercase, lowercase, and a number.' 
            });
        }

        // 6. Check if user already exists
        const existingUser = users.find(u => u.username === username || u.email === email);
        if (existingUser) {
            return res.status(409).json({ error: 'Username or Email already registered.' });
        }

        // 7. Secure Password Hashing
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Save user to mock DB
        users.push({
            username,
            email,
            password: hashedPassword
        });

        // Rotate CSRF token after sensitive operation (Best Practice)
        const newToken = crypto.randomBytes(32).toString('hex');
        csrfStore.set('session_id_demo', newToken);

        res.status(201).json({ message: 'User registered successfully.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});