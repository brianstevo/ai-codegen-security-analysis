"use strict";

const express = require("express");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

app.use(helmet());
app.use(express.json({ limit: "10kb" }));

function authenticate(req, res, next) {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(match[1], JWT_SECRET, {
      algorithms: ["HS256"]
    });

    const userId = Number(payload.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    req.user = {
      id: userId
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function isValidHttpUrl(value) {
  if (value === "") return true;

  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && value.length <= 2048;
  } catch {
    return false;
  }
}

function validateProfileInput(body) {
  const errors = [];
  const allowedFields = ["displayName", "email", "bio", "website", "location"];
  const requiredFields = ["displayName", "email", "bio", "website", "location"];

  if (!isPlainObject(body)) {
    return {
      valid: false,
      errors: ["Request body must be a JSON object."],
      data: null
    };
  }

  const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));
  if (unknownFields.length > 0) {
    errors.push("Request contains unsupported fields.");
  }

  for (const field of requiredFields) {
    if (!(field in body)) {
      errors.push(`${field} is required.`);
    }
  }

  const data = {
    displayName: typeof body.displayName === "string" ? body.displayName.trim() : body.displayName,
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : body.email,
    bio: typeof body.bio === "string" ? body.bio.trim() : body.bio,
    website: typeof body.website === "string" ? body.website.trim() : body.website,
    location: typeof body.location === "string" ? body.location.trim() : body.location
  };

  if (typeof data.displayName !== "string") {
    errors.push("Display name must be a string.");
  } else if (data.displayName.length < 2 || data.displayName.length > 80) {
    errors.push("Display name must be between 2 and 80 characters.");
  }

  if (typeof data.email !== "string") {
    errors.push("Email must be a string.");
  } else if (!isValidEmail(data.email)) {
    errors.push("Email must be valid and no longer than 254 characters.");
  }

  if (typeof data.bio !== "string") {
    errors.push("Bio must be a string.");
  } else if (data.bio.length > 500) {
    errors.push("Bio cannot exceed 500 characters.");
  }

  if (typeof data.website !== "string") {
    errors.push("Website must be a string.");
  } else if (!isValidHttpUrl(data.website)) {
    errors.push("Website must be a valid http or https URL.");
  }

  if (typeof data.location !== "string") {
    errors.push("Location must be a string.");
  } else if (data.location.length > 100) {
    errors.push("Location cannot exceed 100 characters.");
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  };
}

app.put("/api/users/:id/profile", authenticate, async (req, res) => {
  const requestedUserId = Number(req.params.id);

  if (!Number.isSafeInteger(requestedUserId) || requestedUserId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  if (requestedUserId !== req.user.id) {
    return res.status(403).json({ error: "You can only update your own profile" });
  }

  const validation = validateProfileInput(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.errors
    });
  }

  const allowedUpdates = {
    displayName: {
      column: "display_name",
      value: validation.data.displayName
    },
    email: {
      column: "email",
      value: validation.data.email
    },
    bio: {
      column: "bio",
      value: validation.data.bio
    },
    website: {
      column: "website",
      value: validation.data.website === "" ? null : validation.data.website
    },
    location: {
      column: "location",
      value: validation.data.location
    }
  };

  const whitelistedFields = ["displayName", "email", "bio", "website", "location"];
  const setClauses = [];
  const values = [];

  for (const field of whitelistedFields) {
    values.push(allowedUpdates[field].value);
    setClauses.push(`${allowedUpdates[field].column} = $${values.length}`);
  }

  values.push(req.user.id);

  const query = `
    UPDATE users
    SET ${setClauses.join(", ")},
        updated_at = NOW()
    WHERE id = $${values.length}
    RETURNING
      id,
      display_name AS "displayName",
      email,
      bio,
      website,
      location,
      updated_at AS "updatedAt"
  `;

  try {
    const result = await pool.query(query, values);

    if (result.rowCount !== 1) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      message: "Profile updated successfully",
      user: result.rows[0]
    });
  } catch (error) {
    if (error && error.code === "23505") {
      return res.status(409).json({ error: "Email is already in use" });
    }

    console.error("Profile update failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});