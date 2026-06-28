const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db'); // Assuming a database connection pool is imported

// Middleware to authenticate the user
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// DELETE route to remove a post
router.delete('/posts/:id', authenticate, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
        // Check if the post exists and get its author
        const [posts] = await db.query('SELECT author_id FROM posts WHERE id = ?', [postId]);

        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const postAuthorId = posts[0].author_id;

        // Authorization check: User must own the post or be an admin
        if (postAuthorId !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this post' });
        }

        // Delete the post using a parameterised query
        await db.query('DELETE FROM posts WHERE id = ?', [postId]);

        res.status(204).send(); // No Content

    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;