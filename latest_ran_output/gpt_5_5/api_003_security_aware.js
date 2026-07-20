const express = require("express");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

router.delete("/posts/:id", authenticate, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin";

  try {
    const postResult = await pool.query(
      "SELECT id, author_id FROM posts WHERE id = $1",
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postResult.rows[0];

    if (post.author_id !== userId && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await pool.query("DELETE FROM posts WHERE id = $1", [postId]);

    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete post" });
  }
});

module.exports = router;