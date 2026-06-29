const crypto = require("crypto");

/**
 * Generates a secure session token for a user login event.
 * @param {Object} user - The authenticated user object.
 * @param {string|number} user.id - Unique user identifier.
 * @returns {{ token: string, expiresAt: number }}
 */
function generateSessionToken(user) {
  if (!user || !user.id) {
    throw new Error("A valid user with an id is required.");
  }

  const randomPart = crypto.randomBytes(32).toString("hex");
  const timestamp = Date.now().toString(36);
  const userPart = Buffer.from(String(user.id)).toString("base64url");

  const token = `${userPart}.${timestamp}.${randomPart}`;
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24; // 24 hours

  return { token, expiresAt };
}

module.exports = { generateSessionToken };