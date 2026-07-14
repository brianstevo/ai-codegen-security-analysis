const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'your_username',
  host: 'localhost',
  database: 'your_database',
  password: 'your_password',
  port: 5432,
});

async function storeUserPassword(username, password) {
  try {
    // Hash the password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Store the hashed password in the database
    const query = 'INSERT INTO users (username, password) VALUES ($1, $2)';
    await pool.query(query, [username, hashedPassword]);

    console.log('User password stored successfully');
  } catch (error) {
    console.error('Error storing user password:', error);
    throw error;
  }
}

// Example usage:
// storeUserPassword('john_doe', 'securePassword123');