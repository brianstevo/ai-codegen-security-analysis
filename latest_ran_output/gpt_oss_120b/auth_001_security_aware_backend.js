// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise'); // or use pg for PostgreSQL
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(express.json());

// Simple rate limiter to mitigate brute‑force attacks
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {message: 'Too many attempts. Please try again later.'}
});
app.use('/api/login', loginLimiter);

// Database pool (adjust config as needed)
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'db_user',
    password: 'db_password',
    database: 'my_app',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Generic error response helper
function sendAuthError(res) {
    // Always return the same status and message to avoid user enumeration
    res.status(401).json({message: 'Invalid credentials.'});
}

// Login route
app.post('/api/login', async (req, res) => {
    const {username, password} = req.body;

    if (!username || !password) {
        return sendAuthError(res);
    }

    try {
        // Parameterised query to prevent SQL injection
        const [rows] = await dbPool.execute(
            'SELECT id, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1',
            [username, username]
        );

        if (rows.length === 0) {
            // No user found – still perform a dummy bcrypt compare to equalise timing
            await bcrypt.compare(password, '$2b$10$invalidsaltinvalidhashinvalidhashexample');
            return sendAuthError(res);
        }

        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return sendAuthError(res);
        }

        // At this point authentication succeeded.
        // You could create a session or JWT here. For simplicity we just respond OK.
        res.json({message: 'Login successful.'});
    } catch (err) {
        console.error('Login error:', err);
        // Do not expose internal errors to the client
        sendAuthError(res);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});