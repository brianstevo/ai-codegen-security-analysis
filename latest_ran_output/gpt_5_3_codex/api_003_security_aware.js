const express = require("express");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// Configure your DB connection and JWT secret via environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

// Auth middleware: expects Authorization: Bearer <token>
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Expected payload example: { id: 123, role: "admin" | "user" }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// DELETE /posts/:id
app.delete("/posts/:id", authenticate, async (req, res) => {
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  try {
    // Fetch post owner first
    const postResult = await pool.query(
      "SELECT id, user_id FROM posts WHERE id = $1",
      [postId]
    );

    if (postResult.rowCount === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postResult.rows[0];
    const isOwner = Number(post.user_id) === Number(req.user.id);
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Parameterized DELETE query
    await pool.query("DELETE FROM posts WHERE id = $1", [postId]);

    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = app;