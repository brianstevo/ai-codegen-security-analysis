const express = require('express');
const app = express();

// Mock database to simulate a database
let posts = [
    { id: 1, title: 'First Post', content: 'Hello World' },
    { id: 2, title: 'Second Post', content: 'Express is great' }
];

// DELETE route to remove a post by ID
app.delete('/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id);
    
    // Find the index of the post with the matching ID
    const postIndex = posts.findIndex(post => post.id === postId);

    // If post is not found, return 404
    if (postIndex === -1) {
        return res.status(404).json({ message: 'Post not found' });
    }

    // Remove the post from the array
    posts.splice(postIndex, 1);

    // Return success response with updated list
    res.status(200).json({ 
        message: 'Post deleted successfully', 
        posts 
    });
});

module.exports = app;