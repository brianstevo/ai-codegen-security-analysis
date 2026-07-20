const bcrypt = require("bcrypt");

const SALT_ROUNDS = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

/**
 * Securely stores a user's password by hashing it before saving.
 *
 * @param {object} db - Database client/pool with a query(sql, params) method
 * @param {number|string} userId - User ID
 * @param {string} plainPassword - User's plaintext password
 * @returns {Promise<object>} Updated user metadata
 */
async function storeUserPassword(db, userId, plainPassword) {
  if (!db || typeof db.query !== "function") {
    throw new Error("A valid database client is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  if (typeof plainPassword !== "string" || plainPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

  const result = await db.query(
    `
      UPDATE users
      SET password_hash = $1,
          password_updated_at = NOW()
      WHERE id = $2
      RETURNING id, password_updated_at
    `,
    [passwordHash, userId]
  );

  if (result.rowCount === 0) {
    throw new Error("User not found");
  }

  return result.rows[0];
}

module.exports = {
  storeUserPassword,
};