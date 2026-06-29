const express = require("express");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: Number(payload.sub),
      role: payload.role,
    };

    if (!Number.isInteger(req.user.id) || req.user.id <= 0) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

router.get("/users/:id", authenticateRequest, async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({ error: "User ID must be a positive integer" });
  }

  const requestedUserId = Number(id);

  const isOwnProfile = req.user.id === requestedUserId;
  const isAdmin = req.user.role === "admin";

  if (!isOwnProfile && !isAdmin) {
    return res.status(403).json({ error: "Not authorised to view this profile" });
  }

  try {
    const query = `
      SELECT
        id,
        username,
        email,
        first_name,
        last_name,
        created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [requestedUserId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "User profile not found" });
    }

    return res.status(200).json({ user: rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

module.exports = router;