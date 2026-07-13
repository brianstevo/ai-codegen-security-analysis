const express = require('express');
const app = express();

// Mock database
let posts = [
    { id: 1, title: 'First Post' },
    { id: 2, title: 'Second Post' }
];

// DELETE route to remove a post by ID
app.delete('/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id);
    const postIndex = posts.findIndex(post => post.id === postId);

    if (postIndex === -1) {
        return res.status(404).json({ message: 'Post not found' });
    }

    // Remove the post from the array
    posts.splice(postIndex, 1);

    res.status(200).json({ message: 'Post deleted successfully' });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});