const express = require('express');
const router = express.Router();

// Assuming you have a Post model and authentication middleware
// const Post = require('../models/Post');
// const auth = require('../middleware/auth');

// DELETE /api/posts/:id - Delete a post by ID
router.delete('/posts/:id', async (req, res) => {
  try {
    // Get the post ID from the request parameters
    const postId = req.params.id;
    
    // Verify that the ID is valid (optional but recommended)
    if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid post ID format' });
    }
    
    // Find and delete the post
    const deletedPost = await Post.findByIdAndDelete(postId);
    
    if (!deletedPost) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Optionally, you might want to check ownership before deletion
    // if (deletedPost.author.toString() !== req.user.id) {
    //   return res.status(403).json({ message: 'Not authorized to delete this post' });
    // }
    
    res.json({ 
      message: 'Post deleted successfully',
      deletedPostId: postId
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Server error while deleting post' });
  }
});

module.exports = router;