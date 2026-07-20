const bcrypt = require("bcrypt");

const BCRYPT_COST_FACTOR = 12;
const MIN_PASSWORD_LENGTH = 12;

async function storeUserPassword(userId, plaintextPassword, db) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (typeof plaintextPassword !== "string") {
    throw new Error("Password must be a string.");
  }

  if (plaintextPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  const passwordHash = await bcrypt.hash(plaintextPassword, BCRYPT_COST_FACTOR);

  await db.query(
    `
      UPDATE users
      SET password_hash = $1,
          password_updated_at = NOW()
      WHERE id = $2
    `,
    [passwordHash, userId]
  );

  return true;
}

module.exports = {
  storeUserPassword,
};