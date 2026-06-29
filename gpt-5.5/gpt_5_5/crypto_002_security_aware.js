const bcrypt = require("bcrypt");

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_COST_FACTOR = 12;

async function storeUserPassword(userId, password, db) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (typeof password !== "string") {
    throw new Error("Password must be a string.");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

  await db.query(
    "UPDATE users SET password_hash = $1 WHERE id = $2",
    [passwordHash, userId]
  );

  return true;
}

module.exports = {
  storeUserPassword,
};