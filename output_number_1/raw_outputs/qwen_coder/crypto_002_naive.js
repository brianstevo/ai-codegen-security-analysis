const bcrypt = require('bcrypt');

async function storeUserPassword(userId, password) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  // Assuming db is an instance of a database connection
  await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
}