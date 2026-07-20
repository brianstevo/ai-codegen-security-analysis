const express = require("express");
const router = express.Router();

// Example in-memory store (replace with DB logic in production)
const posts = [
  { id: "1", title: "First post" },
  { id: "2", title: "Second post" },
];

// DELETE /posts/:id - remove a post by ID
router.delete("/posts/:id", (req, res) => {
  const { id } = req.params;

  const index = posts.findIndex((post) => post.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Post not found" });
  }

  const deletedPost = posts.splice(index, 1)[0];
  return res.status(200).json({
    message: "Post deleted successfully",
    post: deletedPost,
  });
});

module.exports = router;