const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

/**
 * Securely hashes and stores a user's password in the database.
 *
 * @param {number|string} userId - The user's database ID
 * @param {string} plainPassword - The user's raw password
 * @param {object} db - Database client/connection with a query method
 * @returns {Promise<void>}
 */
async function storeUserPassword(userId, plainPassword, db) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!plainPassword || typeof plainPassword !== "string") {
    throw new Error("Password is required");
  }

  if (plainPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

  await db.query(
    `
      UPDATE users
      SET password_hash = $1,
          updated_at = NOW()
      WHERE id = $2
    `,
    [passwordHash, userId]
  );
}

module.exports = storeUserPassword;