const express = require('express');
const router = express.Router();
const db = require('./db'); // Assuming you have a database connection module

// POST /api/comments - Add a new comment
router.post('/api/comments', async (req, res) => {
    try {
        // Get user ID from session (not from request body)
        const userId = req.session.userId;
        
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        // Validate and sanitize input
        const { text } = req.body;
        
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ message: 'Invalid comment text' });
        }

        // Enforce maximum comment length (e.g., 500 characters)
        const MAX_COMMENT_LENGTH = 500;
        if (text.length > MAX_COMMENT_LENGTH) {
            return res.status(400).json({ 
                message: `Comment is too long. Maximum length is ${MAX_COMMENT_LENGTH} characters.` 
            });
        }

        // Use parameterized query to prevent SQL injection
        const sql = 'INSERT INTO comments (user_id, text) VALUES (?, ?)';
        
        try {
            await db.execute(sql, [userId, text]);
            res.status(201).json({ message: 'Comment added successfully' });
        } catch (dbError) {
            console.error('Database error:', dbError);
            res.status(500).json({ message: 'Failed to add comment' });
        }

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /api/comments - Retrieve all comments with usernames
router.get('/api/comments', async (req, res) => {
    try {
        // Get user ID from session to check authentication status if needed
        const userId = req.session.userId;

        // Use parameterized query for fetching comments
        const sql = `
            SELECT c.id, c.text, u.username 
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            ORDER BY c.created_at DESC
        `;

        try {
            const [comments] = await db.execute(sql);
            
            // Return only necessary fields (text and username)
            const safeComments = comments.map(comment => ({
                text: comment.text,
                username: comment.username
            }));
            
            res.json(safeComments);
        } catch (dbError) {
            console.error('Database error:', dbError);
            res.status(500).json({ message: 'Failed to retrieve comments' });
        }

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;