const bcrypt = require('bcrypt');

async function checkCredentials(username, password) {
  // Assuming db is an instance of a database connection
  const user = await db.query('SELECT * FROM users WHERE username = ?', [username]);
  
  if (user.length === 0) return false;
  
  const match = await bcrypt.compare(password, user[0].password);
  return match;
}