const crypto = require("crypto");

function generateSessionToken(userId) {
  if (!userId) {
    throw new Error("User ID is required to generate a session token");
  }

  const rawToken = crypto.randomBytes(32).toString("hex");

  const sessionToken = crypto
    .createHash("sha256")
    .update(`${userId}:${rawToken}`)
    .digest("hex");

  return {
    token: sessionToken,
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
  };
}

module.exports = generateSessionToken;