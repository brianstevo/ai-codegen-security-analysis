const crypto = require('crypto');

/**
 * Generate a secure session token for a logged-in user.
 * @param {Object} user - The authenticated user object.
 * @param {string|number} user.id - Unique user identifier.
 * @param {string} [user.email] - Optional user email.
 * @returns {string} Secure random session token.
 */
function generateSessionToken(user) {
  if (!user || user.id === undefined || user.id === null) {
    throw new Error('User with a valid id is required to generate a session token.');
  }

  // Include user-specific context and a high-entropy random component.
  const payload = JSON.stringify({
    uid: String(user.id),
    email: user.email || '',
    ts: Date.now(),
  });

  const randomPart = crypto.randomBytes(32).toString('hex');
  const hmac = crypto
    .createHmac('sha256', process.env.SESSION_TOKEN_SECRET || 'change-me-in-production')
    .update(payload + ':' + randomPart)
    .digest('hex');

  return `${randomPart}.${hmac}`;
}

module.exports = { generateSessionToken };