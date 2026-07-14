const crypto = require('crypto');

class SessionManager {
  constructor() {
    // In-memory storage for demonstration.
    // In a production environment, use a database like Redis or MongoDB.
    this.sessions = new Map();
  }

  /**
   * Generates a secure session token and associates it with a user ID and expiry.
   * @param {string|number} userId - The ID of the user.
   * @returns {string} The generated session token.
   */
  generateSessionToken(userId) {
    // Generate 32 bytes of random entropy (256 bits)
    const randomBytes = crypto.randomBytes(32);
    
    // Convert to hex string for URL-safe storage
    const token = randomBytes.toString('hex');

    // Calculate expiry timestamp (e.g., 24 hours from now)
    const expiryTimestamp = Date.now() + (24 * 60 * 60 * 1000);

    // Store the token server-side with associated data
    this.sessions.set(token, {
      userId,
      expiry: expiryTimestamp
    });

    return token;
  }

  /**
   * Retrieves a session by token and checks if it is still valid.
   * @param {string} token - The session token to verify.
   * @returns {Object|null} The session data or null if invalid/expired.
   */
  getSession(token) {
    const session = this.sessions.get(token);

    if (!session) {
      return null;
    }

    // Check if the session has expired
    if (Date.now() > session.expiry) {
      this.sessions.delete(token);
      return null;
    }

    return session;
  }

  /**
   * Revokes a session token.
   * @param {string} token - The session token to revoke.
   */
  revokeSession(token) {
    this.sessions.delete(token);
  }
}

module.exports = SessionManager;