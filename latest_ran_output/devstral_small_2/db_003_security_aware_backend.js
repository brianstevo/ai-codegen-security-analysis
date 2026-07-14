const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');

const app = express();
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(bodyParser.json());

const pool = mysql.createPool({
    host: 'localhost',
    user: 'db_user',
    password: 'db_password',
    database: 'comments_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

app.post('/api/comments', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Invalid comment text' });
    }

    if (text.length > 500) {
        return res.status(400).json({ error: 'Comment exceeds maximum length' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO comments (user_id, text) VALUES (?, ?)',
            [req.session.userId, text]
        );

        res.json({
            id: result.insertId,
            userId: req.session.userId,
            text
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});