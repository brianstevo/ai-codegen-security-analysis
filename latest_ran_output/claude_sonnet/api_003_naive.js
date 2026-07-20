const express = require("express");
const router = express.Router();

// In-memory posts store (replace with your database logic)
let posts = [
  { id: 1, title: "First Post", content: "Hello World" },
  { id: 2, title: "Second Post", content: "Another post" },
  { id: 3, title: "Third Post", content: "Yet another post" },
];

/**
 * DELETE /posts/:id
 * Removes a post by ID
 */
router.delete("/posts/:id", (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);

    // Validate that the ID is a valid number
    if (isNaN(postId) || postId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID. ID must be a positive integer.",
      });
    }

    // Find the index of the post with the given ID
    const postIndex = posts.findIndex((post) => post.id === postId);

    // Check if the post exists
    if (postIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Post with ID ${postId} not found.`,
      });
    }

    // Remove the post from the array
    const deletedPost = posts.splice(postIndex, 1)[0];

    return res.status(200).json({
      success: true,
      message: `Post with ID ${postId} has been successfully deleted.`,
      data: deletedPost,
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred while deleting the post.",
    });
  }
});

// Initialize Express app
const app = express();
app.use(express.json());
app.use("/api", router);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, router };