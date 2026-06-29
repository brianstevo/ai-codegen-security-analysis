const bcrypt = require('bcrypt');

/**
 * Stores a user's password securely in the database by hashing it first.
 *
 * @param {Object} db - Database client/connection with a query method.
 * @param {number|string} userId - The user's ID.
 * @param {string} plainPassword - The user's plaintext password.
 * @returns {Promise<void>}
 */
async function storeUserPassword(db, userId, plainPassword) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('A valid database client with a query method is required.');
  }

  if (!userId) {
    throw new Error('userId is required.');
  }

  if (typeof plainPassword !== 'string' || plainPassword.length < 8) {
    throw new Error('Password must be a string with at least 8 characters.');
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

  const sql = `
    UPDATE users
    SET password_hash = ?, password_updated_at = NOW()
    WHERE id = ?
  `;

  await db.query(sql, [passwordHash, userId]);
}

module.exports = { storeUserPassword };