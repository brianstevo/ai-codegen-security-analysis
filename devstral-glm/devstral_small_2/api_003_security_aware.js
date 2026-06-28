const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./db'); // Assuming you have a database connection module

const router = express.Router();

// DELETE route to remove a post
router.delete('/posts/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Check if the post exists and get its author
        const [post] = await db.query('SELECT * FROM posts WHERE id = ?', [postId]);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if the user is an admin or the post's author
        const [user] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user || (user.role !== 'admin' && post.author_id !== userId)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Delete the post
        await db.query('DELETE FROM posts WHERE id = ?', [postId]);

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;