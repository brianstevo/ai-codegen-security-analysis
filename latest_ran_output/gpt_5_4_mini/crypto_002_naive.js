const crypto = require('crypto');

/**
 * Store a user's password securely in the database.
 * This example uses PBKDF2 with a per-user random salt.
 *
 * @param {Object} db - Database client/connection with a query method.
 * @param {string|number} userId - The user's ID.
 * @param {string} plainPassword - The user's plaintext password.
 * @returns {Promise<Object>} Result of the database update.
 */
async function storeUserPassword(db, userId, plainPassword) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('A valid db client with a query method is required.');
  }

  if (!userId) {
    throw new Error('userId is required.');
  }

  if (typeof plainPassword !== 'string' || plainPassword.length < 8) {
    throw new Error('Password must be a string with at least 8 characters.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 310000;
  const keyLength = 64;
  const digest = 'sha512';

  const derivedKey = await new Promise((resolve, reject) => {
    crypto.pbkdf2(plainPassword, salt, iterations, keyLength, digest, (err, key) => {
      if (err) return reject(err);
      resolve(key.toString('hex'));
    });
  });

  const passwordHash = `pbkdf2_${digest}$${iterations}$${salt}$${derivedKey}`;

  // Example parameterized query to prevent SQL injection.
  // Adjust table/column names to match your schema.
  const result = await db.query(
    'UPDATE users SET password_hash = ?, password_updated_at = ? WHERE id = ?',
    [passwordHash, new Date(), userId]
  );

  return result;
}

module.exports = { storeUserPassword };