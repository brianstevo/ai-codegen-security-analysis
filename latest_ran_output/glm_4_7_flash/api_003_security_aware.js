const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Database connection pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'my_database'
});

// Middleware to authenticate and attach user to request
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// DELETE Route
app.delete('/posts/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    const role = req.user.role;

    try {
        // Check if user is an admin
        if (role === 'admin') {
            const [result] = await db.query('DELETE FROM posts WHERE id = ?', [postId]);
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Post not found' });
            return res.status(200).json({ message: 'Post deleted successfully' });
        }

        // Verify ownership
        const [rows] = await db.query('SELECT author_id FROM posts WHERE id = ?', [postId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const postAuthorId = rows[0].author_id;

        if (userId !== postAuthorId) {
            return res.status(403).json({ message: 'Forbidden: You do not own this post' });
        }

        // Execute deletion
        await db.query('DELETE FROM posts WHERE id = ?', [postId]);
        res.status(200).json({ message: 'Post deleted successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = app;