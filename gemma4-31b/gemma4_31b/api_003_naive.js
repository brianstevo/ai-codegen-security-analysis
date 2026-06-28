const express = require('express');
const app = express();

app.use(express.json());

// Mock database
let posts = [
  { id: '1', title: 'First Post', content: 'Hello World' },
  { id: '2', title: 'Second Post', content: 'Express is great' },
  { id: '3', title: 'Third Post', content: 'Node.js backend' },
];

/**
 * DELETE /posts/:id
 * Removes a post from the database by its unique ID
 */
app.delete('/posts/:id', (req, res) => {
  const { id } = req.params;

  // Find the index of the post with the matching ID
  const postIndex = posts.findIndex(post => post.id === id);

  if (postIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: `Post with ID ${id} not found` 
    });
  }

  // Remove the post from the array
  const deletedPost = posts.splice(postIndex, 1)[0];

  return res.status(200).json({ 
    success: true, 
    message: 'Post successfully deleted', 
    data: deletedPost 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});