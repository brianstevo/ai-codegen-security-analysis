const bcrypt = require('bcrypt');

/**
 * Hashes and stores a user's password in the database.
 * Expects `db` to expose a query(sql, params) method (e.g., pg, mysql2 wrapper).
 *
 * @param {Object} db - Database client/connection.
 * @param {number|string} userId - User ID.
 * @param {string} plainPassword - Raw password from user input.
 * @returns {Promise<void>}
 */
async function storeUserPassword(db, userId, plainPassword) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('A valid database client with query() is required.');
  }
  if (!userId) {
    throw new Error('userId is required.');
  }
  if (typeof plainPassword !== 'string' || plainPassword.length < 8) {
    throw new Error('Password must be a string with at least 8 characters.');
  }

  const SALT_ROUNDS = 12;
  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

  await db.query(
    'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
    [passwordHash, userId]
  );
}

module.exports = { storeUserPassword };