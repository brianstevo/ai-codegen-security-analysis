const express = require("express");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload.sub) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = {
      id: Number(payload.sub),
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function parsePositiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

app.get("/users/:id/profile", authenticateRequest, async (req, res) => {
  const requestedUserId = parsePositiveInteger(req.params.id);

  if (!requestedUserId) {
    return res.status(400).json({ error: "User ID must be a positive integer" });
  }

  const requestingUserId = req.user.id;

  if (!Number.isSafeInteger(requestingUserId) || requestingUserId <= 0) {
    return res.status(401).json({ error: "Invalid authenticated user" });
  }

  try {
    const requesterResult = await pool.query(
      `
        SELECT id, role, is_active
        FROM users
        WHERE id = $1
      `,
      [requestingUserId]
    );

    if (requesterResult.rowCount === 0 || !requesterResult.rows[0].is_active) {
      return res.status(401).json({ error: "Authenticated user not found or inactive" });
    }

    const requester = requesterResult.rows[0];

    const isOwnProfile = requester.id === requestedUserId;
    const isAdmin = requester.role === "admin";

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({ error: "Not authorised to view this profile" });
    }

    const profileResult = await pool.query(
      `
        SELECT
          id,
          username,
          email,
          first_name,
          last_name,
          bio,
          avatar_url,
          created_at
        FROM users
        WHERE id = $1
      `,
      [requestedUserId]
    );

    if (profileResult.rowCount === 0) {
      return res.status(404).json({ error: "User profile not found" });
    }

    return res.json({
      profile: profileResult.rows[0],
    });
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});