const bcrypt = require('bcrypt');

/**
 * Stores a user's password securely in the database.
 *
 * @param {object} db - Database client/connection with a query method.
 * @param {number|string} userId - The ID of the user whose password is being stored.
 * @param {string} plainPassword - The user's plaintext password.
 * @returns {Promise<void>}
 */
async function storeUserPassword(db, userId, plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('A valid password string is required.');
  }

  // Enforce a sane minimum length to mitigate weak passwords.
  if (plainPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  // bcrypt automatically generates a unique salt and embeds it in the hash.
  const SALT_ROUNDS = 12;
  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

  // Use a parameterized query to prevent SQL injection.
  await db.query(
    'UPDATE users SET password_hash = $1, password_updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
}

module.exports = { storeUserPassword };