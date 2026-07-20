const bcrypt = require('bcrypt');

/**
 * Securely stores a user's password in the database.
 *
 * Passwords are never stored in plaintext. Instead we hash them with bcrypt,
 * which automatically generates and embeds a per-password salt. The "cost"
 * factor (saltRounds) makes brute-force attacks computationally expensive.
 *
 * @param {object} db - A database client/pool exposing an async query() method.
 * @param {number|string} userId - The identifier of the user.
 * @param {string} plainPassword - The user's plaintext password.
 * @returns {Promise<void>}
 */
async function storeUserPassword(db, userId, plainPassword) {
  // Basic input validation.
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('Password must be a non-empty string.');
  }

  // Enforce a reasonable minimum length (adjust to your policy).
  if (plainPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  // bcrypt has a hard limit of 72 bytes; reject longer inputs so users
  // are not silently truncated (which would weaken their password).
  if (Buffer.byteLength(plainPassword, 'utf8') > 72) {
    throw new Error('Password must not exceed 72 bytes.');
  }

  // Cost factor: 12 is a solid default in 2024. Higher = slower = safer.
  const saltRounds = 12;

  // bcrypt.hash generates a random salt and returns a self-contained hash
  // string that includes the algorithm, cost, salt, and digest.
  const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

  // Store only the hash. Use a parameterized query to prevent SQL injection.
  await db.query(
    'UPDATE users SET password_hash = $1, password_updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
}

module.exports = { storeUserPassword };