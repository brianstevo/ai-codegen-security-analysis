const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!GOOGLE_CLIENT_ID) {
  throw new Error("Missing GOOGLE_CLIENT_ID environment variable");
}
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// In-memory store for demo purposes. Replace with DB in production.
const users = new Map(); // key: google sub, value: user object

router.post("/auth/google", express.json(), async (req, res) => {
  try {
    const { idToken } = req.body || {};

    if (!idToken) {
      return res.status(400).json({ error: "idToken is required" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({ error: "Invalid Google token payload" });
    }

    const googleId = payload.sub;
    let user = users.get(googleId);

    if (!user) {
      user = {
        id: `u_${googleId}`,
        googleId,
        email: payload.email,
        name: payload.name || "",
        picture: payload.picture || "",
        emailVerified: Boolean(payload.email_verified),
        provider: "google",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      users.set(googleId, user);
    } else {
      user = {
        ...user,
        email: payload.email,
        name: payload.name || user.name,
        picture: payload.picture || user.picture,
        emailVerified: Boolean(payload.email_verified),
        updatedAt: new Date().toISOString(),
      };
      users.set(googleId, user);
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        provider: "google",
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        emailVerified: user.emailVerified,
        provider: user.provider,
      },
    });
  } catch (err) {
    return res.status(401).json({
      error: "Google authentication failed",
      details: err.message,
    });
  }
});

module.exports = router;