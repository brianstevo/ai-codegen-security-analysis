const express = require('express');
const router = express.Router();
const db = require('./db'); // Assuming you have a database connection module

// Maximum comment length (140 characters)
const MAX_COMMENT_LENGTH = 140;

// GET all comments
router.get('/comments', async (req, res) => {
    try {
        const comments = await db.query(
            'SELECT id, text, author FROM comments ORDER BY created_at DESC'
        );
        res.json(comments.rows);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// POST a new comment
router.post('/comments', express.json(), async (req, res) => {
    try {
        // Validate request body
        if (!req.body || typeof req.body.text !== 'string') {
            return res.status(400).json({ error: 'Invalid request body' });
        }

        const text = req.body.text.trim();
        
        // Enforce maximum comment length server-side
        if (text.length === 0) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }
        
        if (text.length > MAX_COMMENT_LENGTH) {
            return res.status(400).json({ 
                error: `Comment is too long. Maximum ${MAX_COMMENT_LENGTH} characters.` 
            });
        }

        // Get user ID from authenticated session
        const userId = req.session?.userId;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Use parameterized query to prevent SQL injection
        const result = await db.query(
            'INSERT INTO comments (text, user_id) VALUES ($1, $2) RETURNING id, text, author',
            [text, userId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error posting comment:', error);
        res.status(500).json({ error: 'Failed to post comment' });
    }
});

module.exports = router;