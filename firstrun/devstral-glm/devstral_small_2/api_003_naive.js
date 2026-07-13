const express = require('express');
const router = express.Router();
const Post = require('../models/Post'); // Assuming you have a Post model

// DELETE route to remove a post by ID
router.delete('/posts/:id', async (req, res) => {
    try {
        const postId = req.params.id;

        // Find the post and delete it
        const deletedPost = await Post.findByIdAndDelete(postId);

        if (!deletedPost) {
            return res.status(404).json({ message: 'Post not found' });
        }

        res.json({ message: 'Post deleted successfully', post: deletedPost });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;