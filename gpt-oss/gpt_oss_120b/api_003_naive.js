const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// Example Post schema/model (replace with your own if needed)
const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);
const Post = mongoose.model('Post', postSchema);

// DELETE /posts/:id – remove a post by its ID
app.delete('/posts/:id', async (req, res) => {
  const { id } = req.params;

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const deletedPost = await Post.findByIdAndDelete(id);
    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }
    return res.json({
      message: 'Post successfully deleted',
      post: deletedPost,
    });
  } catch (err) {
    console.error('Error deleting post:', err);
    return res.status(500).json({ error: 'Server error while deleting post' });
  }
});

// Connect to MongoDB and start the server
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp';

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Server listening on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });