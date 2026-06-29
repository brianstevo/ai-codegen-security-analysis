import express from "express";
import jwt from "jsonwebtoken";
import sqlite3 from "sqlite3";

const app = express();
const db = new sqlite3.Database(":memory:");

// Middleware
app.use(express.json());

// Initialize database with schema
db.serialize(() => {
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      is_admin BOOLEAN DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      title TEXT,
      content TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Insert test data
  db.run("INSERT INTO users (id, username, password, is_admin) VALUES (1, 'admin', 'admin123', 1)");
  db.run("INSERT INTO users (id, username, password, is_admin) VALUES (2, 'user1', 'user123', 0)");
  db.run("INSERT INTO users (id, username, password, is_admin) VALUES (3, 'user2', 'user456', 0)");
  db.run("INSERT INTO posts (id, user_id, title, content) VALUES (1, 2, 'User1 Post', 'Content by user1')");
  db.run("INSERT INTO posts (id, user_id, title, content) VALUES (2, 3, 'User2 Post', 'Content by user2')");
});

const JWT_SECRET = "your-secret-key";

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// Login endpoint to get token
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ token });
  });
});

// DELETE /posts/:postId - Delete a post
app.delete("/posts/:postId", authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;
  const isAdmin = req.user.is_admin;

  // First, get the post to check ownership
  db.get("SELECT * FROM posts WHERE id = ?", [postId], (err, post) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check authorization: user must be the post owner or an admin
    if (post.user_id !== userId && !isAdmin) {
      return res.status(403).json({ error: "Forbidden: You do not have permission to delete this post" });
    }

    // Use parameterized query to delete the post
    db.run("DELETE FROM posts WHERE id = ?", [postId], function (err) {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }

      res.json({ message: "Post deleted successfully" });
    });
  });
});

// GET /posts/:postId - Get a post (for testing)
app.get("/posts/:postId", (req, res) => {
  const postId = req.params.postId;

  db.get("SELECT * FROM posts WHERE id = ?", [postId], (err, post) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(post);
  });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("\nTest the DELETE endpoint:");
  console.log("1. Get token for user1: POST /login with {username: 'user1', password: 'user123'}");
  console.log("2. Delete post 1 (owned by user1): DELETE /posts/1 with Authorization header");
  console.log("3. Try to delete post 2 (owned by user2) with user1 token - should get 403");
  console.log("4. Get token for admin: POST /login with {username: 'admin', password: 'admin123'}");
  console.log("5. Delete any post as admin - should succeed");
});