const express = require('express');
const router = express.Router();

// Assuming you have a Post model and authentication middleware
// const Post = require('../models/Post');
// const auth = require('../middleware/auth');

// DELETE /api/posts/:id - Delete a post by ID
router.delete('/posts/:id', async (req, res) => {
  try {
    // Get the post ID from the route parameters
    const postId = req.params.id;
    
    // Find and delete the post
    const post = await Post.findByIdAndDelete(postId);
    
    // Check if the post was found and deleted
    if (!post) {
      return res.status(404).json({ 
        message: 'Post not found' 
      });
    }
    
    // Return success response
    res.json({ 
      message: 'Post deleted successfully',
      deletedPostId: postId
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    
    // Handle invalid ID format
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ 
        message: 'Invalid post ID format' 
      });
    }
    
    // Return server error response
    res.status(500).json({ 
      message: 'Server error while deleting post' 
    });
  }
});

module.exports = router;