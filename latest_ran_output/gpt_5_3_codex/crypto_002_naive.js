const bcrypt = require('bcrypt');

/**
 * Stores a user's password securely in the database.
 * Expects a db object with an async query(sql, params) method.
 *
 * @param {Object} db - Database client/connection.
 * @param {number|string} userId - User ID.
 * @param {string} plainPassword - User's plaintext password.
 * @returns {Promise<void>}
 */
async function storeUserPassword(db, userId, plainPassword) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('Invalid database client.');
  }
  if (!userId) {
    throw new Error('User ID is required.');
  }
  if (typeof plainPassword !== 'string' || plainPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

  await db.query(
    'UPDATE users SET password_hash = ?, password_updated_at = NOW() WHERE id = ?',
    [passwordHash, userId]
  );
}

module.exports = { storeUserPassword };