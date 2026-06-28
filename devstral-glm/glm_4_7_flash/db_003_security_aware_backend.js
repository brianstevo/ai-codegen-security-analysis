const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise'); // Using promise wrapper for async/await

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(session({
    secret: 'super-secret-session-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Database Connection Pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'secure_comments_db'
});

// Route to post a comment
app.post('/api/comments', async (req, res) => {
    // SECURITY: Retrieve Session ID from the session middleware, NOT from request body
    const sessionId = req.sessionID;

    if (!sessionId) {
        return res.status(401).json({ error: 'Unauthorized: Session not found' });
    }

    const { content } = req.body;

    // Input Validation
    if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Comment content is required' });
    }

    const MAX_LENGTH = 500;
    if (content.length > MAX_LENGTH) {
        return res.status(400).json({ error: `Comment exceeds maximum length of ${MAX_LENGTH} characters` });
    }

    try {
        // SECURITY: Use Parameterized Query (Prepared Statements) to prevent SQL Injection
        // Assuming table structure: comments (id, content, session_id, created_at)
        const query = 'INSERT INTO comments (content, session_id) VALUES (?, ?)';
        const values = [content, sessionId];

        await db.execute(query, values);

        // Mocking a username for the frontend display based on session
        const username = 'User_' + sessionId.substring(0, 8);

        res.status(201).json({ 
            message: 'Comment posted successfully',
            username: username
        });
    } catch (err) {
        console.error('Database Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});